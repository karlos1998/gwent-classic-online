package com.gwentonline.game.engine;

import com.gwentonline.game.engine.card.CardCatalog;
import com.gwentonline.game.engine.card.CardDefinition;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.random.RandomGenerator;

/**
 * Authoritative Gwent game (port of the original {@code Game} flow). Runs on a single thread: all state
 * changes happen inside {@link #run()}, player input arrives only through {@link PlayerDecisions}.
 * The engine is framework free so it can be tested and simulated without Spring.
 */
public final class GwentGame {

    /** Everything needed to start a game. Decks must already be validated by {@link DeckValidator}. */
    public record Setup(
            List<String> nicknames,
            List<DeckSpec> decks,
            CardCatalog catalog,
            RandomGenerator rng,
            GameListener listener,
            PlayerDecisions decisions,
            double pacingFactor) {

        public Setup {
            if (nicknames.size() != 2 || decks.size() != 2) throw new IllegalArgumentException("two players required");
            nicknames = List.copyOf(nicknames);
            decks = List.copyOf(decks);
        }
    }

    private final CardCatalog catalog;
    private final RandomGenerator rng;
    private final GameListener listener;
    private final PlayerDecisions decisions;
    private final Pacer pacer;
    private final CardIdGenerator ids;
    private final List<PlayerState> players;
    private final Board board;
    private final CardEffects effects;
    private final FactionPerks perks;

    private final List<GameEffect> gameStart = new ArrayList<>();
    private final List<GameEffect> roundStart = new ArrayList<>();
    private final List<GameEffect> roundEnd = new ArrayList<>();
    private final List<RoundResult> roundHistory = new ArrayList<>();

    private PlayerState firstPlayer;
    private PlayerState currentPlayer;
    /** player who is currently asked for a turn action (for the turn timer), null between turns */
    private volatile PlayerState turnOwner;
    private int roundCount;
    private boolean randomRespawn;
    private boolean doubleSpyPower;
    private volatile boolean finished;

    private GwentGame(Setup setup) {
        this.catalog = setup.catalog();
        this.rng = setup.rng();
        this.listener = Objects.requireNonNullElse(setup.listener(), GameListener.NONE);
        this.decisions = setup.decisions();
        this.pacer = new Pacer(listener, setup.pacingFactor());
        this.ids = new CardIdGenerator(rng);
        List<PlayerState> list = new ArrayList<>(2);
        for (int seat = 0; seat < 2; seat++) {
            DeckSpec spec = setup.decks().get(seat);
            Faction faction = Faction.fromKey(spec.faction()).orElseThrow();
            list.add(new PlayerState(seat, setup.nicknames().get(seat), faction, new Deck(rng)));
        }
        this.players = List.copyOf(list);
        players.get(0).setOpponent(players.get(1));
        players.get(1).setOpponent(players.get(0));
        for (int seat = 0; seat < 2; seat++) buildDeck(players.get(seat), setup.decks().get(seat));
        this.board = new Board(this, players.get(0), players.get(1));
        this.effects = new CardEffects(this);
        this.perks = new FactionPerks(this);
    }

    public static GwentGame create(Setup setup) {
        return new GwentGame(setup);
    }

    private void buildDeck(PlayerState player, DeckSpec spec) {
        for (DeckSpec.Entry entry : spec.cards()) {
            CardDefinition definition = catalog.get(entry.index());
            for (int i = 0; i < entry.count(); i++) player.getDeck().add(createCard(definition, player));
        }
        CardInstance leader = createCard(catalog.get(spec.leader()), player);
        player.setLeader(leader);
        player.setLeaderState(leader.isActivatableLeader() ? LeaderState.AVAILABLE : LeaderState.PASSIVE);
    }

    // =================================================================== game flow

    /** Plays the whole game. Blocks until it is over. */
    public GameResult run() {
        try {
            startGame();
            do {
                playRound();
            } while (players.stream().allMatch(p -> p.getHealth() > 0));
            return endGame(null);
        } catch (GameTerminatedException e) {
            return endGame(e);
        } finally {
            finished = true;
            turnOwner = null;
        }
    }

    private void startGame() {
        initPlayers();
        sound("game_opening", null, Audience.EVERYONE);
        runEffects(gameStart);
        if (firstPlayer == null) {
            firstPlayer = rng.nextBoolean() ? players.get(0) : players.get(1);
            notify(Notice.COIN, firstPlayer);
        }
        sound("redraw", null, Audience.EVERYONE);
        List<Runnable> deal = new ArrayList<>();
        for (int i = 0; i < GameRules.STARTING_HAND; i++) players.forEach(p -> deal.add(() -> board.draw(p)));
        pacer.parallel(deal);
        sound("game_start", null, Audience.EVERYONE);
        decisions.mulligan(new MulliganPhase());
        currentPlayer = firstPlayer;
    }

    /** Leader passives and faction perks (original {@code initPlayers}). */
    private void initPlayers() {
        boolean whiteFlame = players.stream().anyMatch(p -> "emhyr_whiteflame".equals(p.getLeader().getLeaderAbility()));
        if (whiteFlame) {
            players.forEach(p -> p.setLeaderState(LeaderState.USED));
        } else {
            players.forEach(this::initLeader);
        }
        boolean bothScoiatael = players.stream().allMatch(p -> p.getFaction() == Faction.SCOIATAEL);
        if (!bothScoiatael) players.forEach(perks::register);
    }

    private void initLeader(PlayerState player) {
        switch (Objects.requireNonNullElse(player.getLeader().getLeaderAbility(), "")) {
            case "francesca_daisy" -> onGameStart(() -> {
                if (!player.getDeck().isEmpty()) {
                    CardInstance extra = player.getDeck().top();
                    player.getDeck().remove(extra);
                    player.getHand().add(extra);
                    changed();
                }
                return true;
            });
            case "king_bran" -> board.rowsOf(player).forEach(r -> r.setHalfWeather(true));
            case "emhyr_invader" -> onGameStart(() -> {
                randomRespawn = true;
                return true;
            });
            case "eredin_treacherous" -> onGameStart(() -> {
                doubleSpyPower = true;
                return true;
            });
            default -> { /* activatable leader */ }
        }
    }

    private void playRound() {
        firstPlayer = currentPlayer;
        roundCount++;
        changed();
        if (roundCount == 1) sound("round1_start", null, Audience.EVERYONE);
        runEffects(roundStart);
        players.forEach(p -> {
            if (!p.canPlay()) p.setPassed(true);
        });
        if (!allPassed()) {
            if (currentPlayer.isPassed()) currentPlayer = currentPlayer.getOpponent();
            notify(Notice.ROUND_START, currentPlayer);
            sound("turn", currentPlayer, Audience.EVERYONE);
            notify(Notice.TURN, currentPlayer);
            while (true) {
                takeTurn(currentPlayer);
                if (!currentPlayer.isPassed() && !currentPlayer.canPlay()) currentPlayer.setPassed(true);
                changed();
                if (currentPlayer.isPassed()) notify(Notice.PASS, currentPlayer);
                if (allPassed()) break;
                if (!currentPlayer.getOpponent().isPassed()) {
                    currentPlayer = currentPlayer.getOpponent();
                    sound("turn", currentPlayer, Audience.EVERYONE);
                    notify(Notice.TURN, currentPlayer);
                }
            }
        }
        endRound();
    }

    private void takeTurn(PlayerState player) {
        turnOwner = player;
        changed();
        TurnAction action;
        try {
            action = decisions.awaitTurn(player);
        } finally {
            turnOwner = null;
            changed();
        }
        if (validate(player, action).isPresent()) action = new TurnAction.Pass();
        execute(player, action);
    }

    private void execute(PlayerState player, TurnAction action) {
        switch (action) {
            case TurnAction.Pass ignored -> {
                player.setPassed(true);
                sound("pass", null, Audience.only(player));
            }
            case TurnAction.ActivateLeader ignored -> {
                event(new GameEvent.CardPreview(player.getLeader(), Pacing.LEADER_PREVIEW.millis(), Audience.except(player)));
                pacer.pause(Pacing.LEADER_PREVIEW);
                effects.activateLeader(player);
                player.setLeaderState(LeaderState.USED);
                changed();
            }
            case TurnAction.PlayCard play -> playCard(player, play);
        }
    }

    private void playCard(PlayerState player, TurnAction.PlayCard play) {
        CardInstance card = player.getHand().byId(play.cardId()).orElseThrow();
        event(new GameEvent.CardPreview(card, Pacing.PREVIEW.millis(), Audience.except(player)));
        pacer.pause(Pacing.PREVIEW);
        if (card.isNamed("Scorch")) {
            effects.scorch(card, null);
            board.toGrave(card, player.getHand());
        } else if (card.isNamed("Decoy")) {
            CardInstance target = decoyTarget(player, play.targetCardId()).orElseThrow();
            Row row = board.rowContaining(target).orElseThrow();
            pacer.parallel(List.of(
                    () -> board.toHand(target, row),
                    () -> board.moveTo(card, row, player.getHand())));
        } else if (card.isWeather()) {
            board.moveTo(card, board.weather(), player.getHand());
        } else {
            Row row = board.row(play.slot().isOwn() ? player : player.getOpponent(), play.slot().rowType());
            board.moveTo(card, row, player.getHand());
        }
    }

    /**
     * Checks a turn action against the rules. Everything coming from a client goes through here.
     *
     * @return an error code if the action is illegal
     */
    public Optional<String> validate(PlayerState player, TurnAction action) {
        if (action == null) return Optional.of("action.missing");
        return switch (action) {
            case TurnAction.Pass ignored -> Optional.empty();
            case TurnAction.ActivateLeader ignored ->
                    player.isLeaderAvailable() ? Optional.empty() : Optional.of("action.leaderUnavailable");
            case TurnAction.PlayCard play -> validatePlay(player, play);
        };
    }

    private Optional<String> validatePlay(PlayerState player, TurnAction.PlayCard play) {
        Optional<CardInstance> found = player.getHand().byId(play.cardId());
        if (found.isEmpty()) return Optional.of("action.cardNotInHand");
        CardInstance card = found.get();
        if (card.isNamed("Scorch")) return Optional.empty();
        if (card.isNamed("Decoy")) {
            return decoyTarget(player, play.targetCardId()).isPresent() ? Optional.empty() : Optional.of("action.invalidTarget");
        }
        BoardSlot slot = play.slot();
        if (slot == null) return Optional.of("action.slotMissing");
        if (card.isWeather()) return slot.isWeather() ? Optional.empty() : Optional.of("action.invalidSlot");
        if (slot.isWeather()) return Optional.of("action.invalidSlot");
        if (card.isSpecial()) {
            return slot.isOwn() && board.row(player, slot.rowType()).getSpecial() == null
                    ? Optional.empty() : Optional.of("action.invalidSlot");
        }
        return legalSlots(card).contains(slot) ? Optional.empty() : Optional.of("action.invalidSlot");
    }

    /** Slots a unit card may be played to (agile: own close or ranged, spy: opponent's side). */
    public List<BoardSlot> legalSlots(CardInstance card) {
        if (card.isAgile()) return List.of(BoardSlot.OWN_CLOSE, BoardSlot.OWN_RANGED);
        return RowType.fromKey(card.getRow())
                .map(type -> List.of(BoardSlot.of(!card.hasAbility("spy"), type)))
                .orElse(List.of());
    }

    /** A Decoy can swap any non-hero unit on the player's own side of the board. */
    private Optional<CardInstance> decoyTarget(PlayerState player, Integer targetId) {
        if (targetId == null) return Optional.empty();
        return board.rowsOf(player)
                .flatMap(r -> r.cards().stream())
                .filter(c -> c.getId() == targetId && c.isUnit())
                .findFirst();
    }

    void endRound() {
        PlayerState p0 = players.get(0);
        PlayerState p1 = players.get(1);
        int dif = p0.getTotal() - p1.getTotal();
        if (dif == 0) {
            boolean nilf0 = p0.getFaction() == Faction.NILFGAARD;
            boolean nilf1 = p1.getFaction() == Faction.NILFGAARD;
            if (nilf0 != nilf1) dif = nilf0 ? 1 : -1;
        }
        PlayerState winner = dif > 0 ? p0 : dif < 0 ? p1 : null;
        roundHistory.add(new RoundResult(winner == null ? null : winner.getSeat(), p0.getTotal(), p1.getTotal()));
        runEffects(roundEnd);
        for (PlayerState p : players) {
            if (p != winner && p.getHealth() > 0) p.setHealth(p.getHealth() - 1);
            p.setPassed(false);
            p.setWinning(false);
        }
        changed();
        sound("round_result", winner, Audience.EVERYONE);
        board.clearRound();
        notify(Notice.ROUND_RESULT, winner);
        currentPlayer = dif < 0 ? p1 : dif > 0 ? p0 : firstPlayer;
    }

    private GameResult endGame(GameTerminatedException terminated) {
        Integer winner;
        if (terminated != null) {
            winner = terminated.loser().getOpponent().getSeat();
        } else {
            PlayerState p0 = players.get(0);
            PlayerState p1 = players.get(1);
            if (p0.getHealth() <= 0 && p1.getHealth() <= 0) winner = null;
            else winner = p1.getHealth() <= 0 ? 0 : 1;
        }
        PlayerState winnerState = winner == null ? null : players.get(winner);
        if (terminated == null) sound("game_result", winnerState, Audience.EVERYONE);
        changed();
        return new GameResult(winner, roundHistory, terminated == null ? null : terminated.reason());
    }

    private boolean allPassed() {
        return players.stream().allMatch(PlayerState::isPassed);
    }

    private void runEffects(List<GameEffect> list) {
        for (int i = list.size() - 1; i >= 0; --i) {
            if (i < list.size() && list.get(i).run()) list.remove(i);
        }
    }

    // =================================================================== mulligan

    private final class MulliganPhase implements PlayerDecisions.Mulligan {

        private final int[] swaps = new int[2];
        private final boolean[] done = new boolean[2];

        @Override
        public List<PlayerState> players() {
            return players;
        }

        @Override
        public int remaining(PlayerState player) {
            return done[player.getSeat()] ? 0 : GameRules.MULLIGAN_SWAPS - swaps[player.getSeat()];
        }

        @Override
        public boolean swap(PlayerState player, int cardId) {
            if (remaining(player) <= 0 || player.getDeck().isEmpty()) return false;
            Optional<CardInstance> card = player.getHand().byId(cardId);
            if (card.isEmpty()) return false;
            Hand hand = player.getHand();
            int index = hand.indexOf(card.get());
            hand.remove(card.get());
            player.getDeck().add(card.get());
            CardInstance drawn = player.getDeck().top();
            player.getDeck().remove(drawn);
            if (index == 0) hand.add(drawn);
            else hand.insertAt(index, drawn);
            swaps[player.getSeat()]++;
            sound("redraw", null, Audience.only(player));
            changed();
            if (remaining(player) == 0) done[player.getSeat()] = true;
            return true;
        }

        @Override
        public void finish(PlayerState player) {
            done[player.getSeat()] = true;
        }

        @Override
        public boolean isFinished(PlayerState player) {
            return done[player.getSeat()];
        }
    }

    // =================================================================== services for Board / effects / perks

    CardInstance createCard(CardDefinition definition, PlayerState holder) {
        return new CardInstance(ids.next(), definition, holder);
    }

    void changed() {
        listener.stateChanged();
    }

    void event(GameEvent event) {
        listener.onEvent(event);
    }

    void sound(String key, PlayerState subject, Audience audience) {
        if (key != null) event(new GameEvent.Sound(key, subject, audience));
    }

    void animate(CardInstance card, String animation) {
        event(new GameEvent.CardAnimation(card, animation, Audience.EVERYONE));
        pacer.pause(Pacing.ANIMATION);
    }

    /** Notification for everyone, then waits until it was shown. */
    void notify(Notice notice, PlayerState subject) {
        event(new GameEvent.Notification(notice, subject, Audience.EVERYONE));
        pacer.pause(Pacing.NOTIFICATION);
    }

    void notify(Notice notice, PlayerState subject, Audience audience) {
        event(new GameEvent.Notification(notice, subject, audience));
    }

    void reveal(List<CardInstance> cards, String titleKey, PlayerState viewer) {
        if (!cards.isEmpty()) event(new GameEvent.Reveal(List.copyOf(cards), titleKey, Audience.only(viewer)));
    }

    void updateLeading() {
        int dif = players.get(0).getTotal() - players.get(1).getTotal();
        players.get(0).setWinning(dif > 0);
        players.get(1).setWinning(dif < 0);
    }

    void onGameStart(GameEffect effect) {
        gameStart.add(effect);
    }

    void onRoundStart(GameEffect effect) {
        roundStart.add(effect);
    }

    void onRoundEnd(GameEffect effect) {
        roundEnd.add(effect);
    }

    Pacer pacer() {
        return pacer;
    }

    Board board() {
        return board;
    }

    CardEffects effects() {
        return effects;
    }

    CardCatalog catalog() {
        return catalog;
    }

    RandomGenerator rng() {
        return rng;
    }

    PlayerDecisions decisions() {
        return decisions;
    }

    boolean isRandomRespawn() {
        return randomRespawn;
    }

    boolean isDoubleSpyPower() {
        return doubleSpyPower;
    }

    void setFirstPlayer(PlayerState player) {
        this.firstPlayer = player;
    }

    void setCurrentPlayer(PlayerState player) {
        this.currentPlayer = player;
    }

    PlayerState currentPlayer() {
        return currentPlayer;
    }

    List<RoundResult> roundHistory() {
        return Collections.unmodifiableList(roundHistory);
    }

    // =================================================================== read access for views

    public PlayerState player(int seat) {
        return players.get(seat);
    }

    public List<PlayerState> players() {
        return players;
    }

    public Row row(PlayerState side, RowType type) {
        return board.row(side, type);
    }

    public WeatherZone weather() {
        return board.weather();
    }

    public int roundCount() {
        return roundCount;
    }

    public Optional<PlayerState> turnOwner() {
        return Optional.ofNullable(turnOwner);
    }

    public List<RoundResult> rounds() {
        return roundHistory();
    }

    public boolean isFinished() {
        return finished;
    }
}
