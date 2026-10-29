package com.gwentonline.game.room;

import com.gwentonline.common.SecureIds;
import com.gwentonline.game.engine.BoardSlot;
import com.gwentonline.game.engine.CardInstance;
import com.gwentonline.game.engine.ChoiceKind;
import com.gwentonline.game.engine.DeckSpec;
import com.gwentonline.game.engine.GameEvent;
import com.gwentonline.game.engine.GameListener;
import com.gwentonline.game.engine.GameResult;
import com.gwentonline.game.engine.GameTerminatedException;
import com.gwentonline.game.engine.GwentGame;
import com.gwentonline.game.engine.PlayerDecisions;
import com.gwentonline.game.engine.PlayerState;
import com.gwentonline.game.engine.RoundResult;
import com.gwentonline.game.engine.RowType;
import com.gwentonline.game.engine.TurnAction;
import com.gwentonline.game.engine.card.CardCatalog;
import com.gwentonline.player.GuestSession;
import com.gwentonline.protocol.CardDto;
import com.gwentonline.protocol.ClientMessage;
import com.gwentonline.protocol.GameSnapshotDto;
import com.gwentonline.protocol.PlayerProfileDto;
import com.gwentonline.protocol.PromptDto;
import com.gwentonline.protocol.ServerMessage;
import lombok.extern.slf4j.Slf4j;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * One running online game. The engine runs on a dedicated virtual thread and owns all game state;
 * client commands only enter through {@link #inbox}, so no locking of game state is needed.
 *
 * <p>The room is the engine's {@link PlayerDecisions} (prompts with server-side deadlines and legal defaults)
 * and {@link GameListener} (per-player snapshots and effects).</p>
 */
@Slf4j
public final class GameRoom implements PlayerDecisions, GameListener, Runnable {

    /** Inputs processed by the game thread. */
    sealed interface Input {
        record Command(int seat, ClientMessage.GameCommand command) implements Input {
        }

        record ConnectionChanged(int seat, boolean connected) implements Input {
        }

        record Shutdown() implements Input {
        }
    }

    /** Settings used by a room. */
    public record Settings(Duration turnTimeout, Duration reconnectGrace, double pacingFactor) {
    }

    private record ActivePrompt(PromptDto prompt, long deadline) {
    }

    private static final int INBOX_CAPACITY = 256;
    private static final long CONTROL_POLL_MS = 250;

    private final String id;
    private final List<GuestSession> seats;
    private final List<PlayerProfileDto> profiles;
    private final GwentGame game;
    private final Settings settings;
    private final Clock clock;
    private final Consumer<GameRoom> onFinished;
    private final BlockingQueue<Input> inbox = new LinkedBlockingQueue<>(INBOX_CAPACITY);
    private final ActivePrompt[] prompts = new ActivePrompt[2];
    private final Instant[] disconnectedAt = new Instant[2];
    private final SecureRandom random = new SecureRandom();
    private volatile Thread thread;
    private boolean dirty = true;
    private long version;
    private boolean timerVisible;
    private int timerOwnerSeat = -1;
    private long timerDeadline;

    GameRoom(String id, List<GuestSession> seats, List<DeckSpec> decks, CardCatalog catalog, Settings settings,
             Clock clock, Consumer<GameRoom> onFinished) {
        this.id = id;
        this.seats = List.copyOf(seats);
        this.profiles = seats.stream().map(GuestSession::profile).toList();
        this.settings = settings;
        this.clock = clock;
        this.onFinished = onFinished;
        this.game = GwentGame.create(new GwentGame.Setup(
                seats.stream().map(GuestSession::getNickname).toList(), decks, catalog, random, this, this,
                settings.pacingFactor()));
    }

    public String id() {
        return id;
    }

    public List<GuestSession> seats() {
        return seats;
    }

    void start() {
        for (int seat = 0; seat < 2; seat++) sendGameStarted(seat);
        thread = Thread.ofVirtual().name("game-" + id).start(this);
    }

    @Override
    public void run() {
        try {
            GameResult result = game.run();
            flush();
            hideTimer();
            for (int seat = 0; seat < 2; seat++) seats.get(seat).send(gameOver(result, seat));
            log.info("Game {} finished: winner seat {} ({})", id, result.winnerSeat(), result.reason());
        } catch (RuntimeException e) {
            log.error("Game {} crashed", id, e);
            seats.forEach(s -> s.send(new ServerMessage.ErrorMessage("game.crashed")));
        } finally {
            onFinished.accept(this);
        }
    }

    // =================================================================== entry points (any thread)

    void submit(GuestSession session, ClientMessage.GameCommand command) {
        int seat = seatOf(session);
        if (seat < 0) return;
        if (!inbox.offer(new Input.Command(seat, command))) session.send(new ServerMessage.ErrorMessage("rateLimited"));
    }

    void connectionChanged(GuestSession session, boolean connected) {
        int seat = seatOf(session);
        if (seat >= 0) inbox.offer(new Input.ConnectionChanged(seat, connected));
    }

    void shutdown() {
        inbox.offer(new Input.Shutdown());
    }

    boolean isRunning() {
        Thread t = thread;
        return t != null && t.isAlive();
    }

    private int seatOf(GuestSession session) {
        return seats.indexOf(session);
    }

    // =================================================================== PlayerDecisions (game thread)

    @Override
    public TurnAction awaitTurn(PlayerState player) {
        PromptDto prompt = prompt(PromptDto.Kind.TURN, null, List.of(), null, false, 0);
        return await(player, prompt, answer -> switch (answer) {
            case ClientMessage.Pass ignored -> Optional.of(new TurnAction.Pass());
            case ClientMessage.ActivateLeader ignored -> legal(player, new TurnAction.ActivateLeader());
            case ClientMessage.PlayCard play -> parseSlot(play.slot())
                    .flatMap(slot -> legal(player, new TurnAction.PlayCard(play.cardId(), slot, play.targetCardId())));
            default -> Optional.empty();
        }, TurnAction.Pass::new);
    }

    @Override
    public Optional<CardInstance> chooseCard(PlayerState player, ChoiceKind kind, List<CardInstance> options, boolean cancellable) {
        PromptDto prompt = prompt(PromptDto.Kind.CHOOSE_CARD, kind.name(), SnapshotFactory.cards(options), null, cancellable, 1);
        return await(player, prompt, message -> {
            if (!(message instanceof ClientMessage.ChooseCard choose)) return Optional.empty();
            if (choose.cardId() == null) return cancellable ? Optional.of(Optional.<CardInstance>empty()) : Optional.empty();
            return options.stream().filter(c -> c.getId() == choose.cardId()).findFirst().map(Optional::of);
        }, () -> cancellable ? Optional.empty() : Optional.of(options.get(random.nextInt(options.size()))));
    }

    @Override
    public RowType chooseAgileRow(PlayerState player, CardInstance card) {
        PromptDto prompt = prompt(PromptDto.Kind.CHOOSE_ROW, null, List.of(), SnapshotFactory.card(card), false, 1);
        return await(player, prompt, message -> message instanceof ClientMessage.ChooseRow choose
                ? RowType.fromKey(choose.row().toLowerCase(Locale.ROOT)).filter(r -> r != RowType.SIEGE)
                : Optional.empty(), () -> RowType.CLOSE);
    }

    @Override
    public boolean chooseToStart(PlayerState player) {
        PromptDto prompt = prompt(PromptDto.Kind.CHOOSE_START, null, List.of(), null, false, 1);
        return await(player, prompt, message -> message instanceof ClientMessage.ChooseStart choose
                ? Optional.of(choose.start())
                : Optional.empty(), () -> true);
    }

    /** Both players redraw at the same time; each swap is applied immediately and the prompt is refreshed. */
    @Override
    public void mulligan(Mulligan mulligan) {
        flush();
        long deadline = clock.millis() + settings.turnTimeout().toMillis();
        for (PlayerState p : mulligan.players()) openMulliganPrompt(p, mulligan, deadline);
        showTimer(null, deadline, true);
        try {
            while (mulligan.players().stream().anyMatch(p -> !mulligan.isFinished(p))) {
                long remaining = deadline - clock.millis();
                if (remaining <= 0) break;
                Input input = poll(remaining);
                if (input == null) continue;
                if (input instanceof Input.Command(int seat, ClientMessage.PromptAnswer answer)
                        && prompts[seat] != null && answer.promptId().equals(prompts[seat].prompt().promptId())) {
                    PlayerState player = game.player(seat);
                    boolean changed = switch (answer) {
                        case ClientMessage.ChooseCard choose when choose.cardId() != null -> mulligan.swap(player, choose.cardId());
                        case ClientMessage.ChooseCard ignored -> finishMulligan(mulligan, player);
                        case ClientMessage.FinishMulligan ignored -> finishMulligan(mulligan, player);
                        default -> false;
                    };
                    if (!changed) sendError(seat, "action.invalid");
                    flush();
                    if (mulligan.isFinished(player)) closePrompt(seat);
                    else openMulliganPrompt(player, mulligan, deadline);
                } else {
                    handleControl(input);
                }
            }
        } finally {
            mulligan.players().forEach(p -> {
                mulligan.finish(p);
                closePrompt(p.getSeat());
            });
            hideTimer();
        }
    }

    private boolean finishMulligan(Mulligan mulligan, PlayerState player) {
        mulligan.finish(player);
        return true;
    }

    private void openMulliganPrompt(PlayerState player, Mulligan mulligan, long deadline) {
        String promptId = prompts[player.getSeat()] != null ? prompts[player.getSeat()].prompt().promptId() : SecureIds.id();
        PromptDto prompt = new PromptDto(promptId, PromptDto.Kind.MULLIGAN, settings.turnTimeout().toMillis(),
                Math.max(0, deadline - clock.millis()), null, List.of(), null, true, mulligan.remaining(player));
        prompts[player.getSeat()] = new ActivePrompt(prompt, deadline);
        seats.get(player.getSeat()).send(new ServerMessage.Prompt(prompt));
    }

    /**
     * Sends a prompt to one player and waits for a valid answer, the deadline or a control event.
     * Invalid answers are rejected with an error and do not stop the clock.
     */
    private <T> T await(PlayerState player, PromptDto prompt, Function<ClientMessage.PromptAnswer, Optional<T>> parse,
                        Supplier<T> onTimeout) {
        int seat = player.getSeat();
        flush();
        long deadline = clock.millis() + prompt.timeoutMs();
        prompts[seat] = new ActivePrompt(prompt, deadline);
        seats.get(seat).send(new ServerMessage.Prompt(prompt));
        showTimer(player, deadline, false);
        try {
            while (true) {
                long remaining = deadline - clock.millis();
                if (remaining <= 0) return onTimeout.get();
                Input input = poll(remaining);
                if (input == null) continue;
                if (input instanceof Input.Command(int from, ClientMessage.PromptAnswer answer)
                        && from == seat && answer.promptId().equals(prompt.promptId())) {
                    Optional<T> result = parse.apply(answer);
                    if (result.isPresent()) return result.get();
                    sendError(seat, "action.invalid");
                } else {
                    handleControl(input);
                }
            }
        } finally {
            closePrompt(seat);
            hideTimer();
        }
    }

    private Optional<TurnAction> legal(PlayerState player, TurnAction action) {
        Optional<String> error = game.validate(player, action);
        error.ifPresent(code -> sendError(player.getSeat(), code));
        return error.isPresent() ? Optional.empty() : Optional.of(action);
    }

    private static Optional<BoardSlot> parseSlot(String slot) {
        if (slot == null) return Optional.of(BoardSlot.OWN_CLOSE);
        try {
            return Optional.of(BoardSlot.valueOf(slot));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private PromptDto prompt(PromptDto.Kind kind, String choice, List<CardDto> options, CardDto card, boolean cancellable, int remaining) {
        long timeout = settings.turnTimeout().toMillis();
        return new PromptDto(SecureIds.id(), kind, timeout, timeout, choice, options, card, cancellable, remaining);
    }

    private void closePrompt(int seat) {
        ActivePrompt active = prompts[seat];
        if (active == null) return;
        prompts[seat] = null;
        seats.get(seat).send(new ServerMessage.PromptClosed(active.prompt().promptId()));
    }

    // =================================================================== GameListener (game thread)

    @Override
    public void stateChanged() {
        dirty = true;
    }

    @Override
    public void onEvent(GameEvent event) {
        flush();
        for (int seat = 0; seat < 2; seat++) {
            PlayerState recipient = game.player(seat);
            if (!event.audience().includes(recipient)) continue;
            int s = seat;
            EventTranslator.translate(event, recipient, SnapshotFactory.visibleCardIds(game, seat))
                    .ifPresent(fx -> seats.get(s).send(new ServerMessage.Fx(fx)));
        }
    }

    /** Animation pause: keeps handling surrender / connection events while the clients animate. */
    @Override
    public void pause(long millis) {
        flush();
        long deadline = clock.millis() + millis;
        while (true) {
            checkForfeit();
            long remaining = deadline - clock.millis();
            if (remaining <= 0) return;
            Input input = poll(remaining);
            if (input != null) handleControl(input);
        }
    }

    // =================================================================== control events

    /** Everything that is not an answer to the current prompt. May end the game. */
    private void handleControl(Input input) {
        switch (input) {
            case Input.Command(int seat, ClientMessage.Surrender ignored) ->
                    throw new GameTerminatedException(game.player(seat), GameTerminatedException.Reason.SURRENDER);
            case Input.Command(int seat, ClientMessage.GameCommand ignored) ->
                    sendError(seat, prompts[seat] == null ? "game.notYourTurn" : "prompt.stale");
            case Input.ConnectionChanged(int seat, boolean connected) -> connectionChanged(seat, connected);
            case Input.Shutdown ignored ->
                    throw new GameTerminatedException(game.player(0), GameTerminatedException.Reason.SERVER_SHUTDOWN);
        }
    }

    private void connectionChanged(int seat, boolean connected) {
        GuestSession opponent = seats.get(1 - seat);
        if (connected) {
            disconnectedAt[seat] = null;
            resync(seat);
            opponent.send(new ServerMessage.OpponentConnection(true, 0));
        } else {
            disconnectedAt[seat] = clock.instant();
            opponent.send(new ServerMessage.OpponentConnection(false, settings.reconnectGrace().toMillis()));
        }
    }

    /** Full state for a (re)connected player: board, open prompt with the remaining time, timer. */
    private void resync(int seat) {
        GuestSession session = seats.get(seat);
        sendGameStarted(seat);
        session.send(new ServerMessage.State(SnapshotFactory.snapshot(game, seat, version, profiles)));
        ActivePrompt active = prompts[seat];
        if (active != null) {
            PromptDto p = active.prompt();
            long remaining = Math.max(0, active.deadline() - clock.millis());
            session.send(new ServerMessage.Prompt(new PromptDto(p.promptId(), p.kind(), p.timeoutMs(), remaining, p.choice(),
                    p.options(), p.card(), p.cancellable(), p.remaining())));
        }
        if (timerVisible) session.send(relativeTimer(seat));
    }

    private void checkForfeit() {
        Instant now = clock.instant();
        for (int seat = 0; seat < 2; seat++) {
            Instant since = disconnectedAt[seat];
            if (since != null && Duration.between(since, now).compareTo(settings.reconnectGrace()) > 0) {
                throw new GameTerminatedException(game.player(seat), GameTerminatedException.Reason.DISCONNECT);
            }
        }
    }

    private Input poll(long timeoutMs) {
        checkForfeit();
        try {
            return inbox.poll(Math.min(timeoutMs, CONTROL_POLL_MS), TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GameTerminatedException(game.player(0), GameTerminatedException.Reason.SERVER_SHUTDOWN);
        }
    }

    // =================================================================== outgoing messages

    private void flush() {
        if (!dirty) return;
        dirty = false;
        version++;
        for (int seat = 0; seat < 2; seat++) {
            seats.get(seat).send(new ServerMessage.State(SnapshotFactory.snapshot(game, seat, version, profiles)));
        }
    }

    /** @param owner player who has to act, or {@code null} if both act at the same time (mulligan) */
    private void showTimer(PlayerState owner, long deadline, boolean both) {
        timerVisible = true;
        timerOwnerSeat = both ? -1 : owner.getSeat();
        timerDeadline = deadline;
        for (int seat = 0; seat < 2; seat++) seats.get(seat).send(relativeTimer(seat));
    }

    private ServerMessage.Timer relativeTimer(int seat) {
        if (!timerVisible) return new ServerMessage.Timer(null, 0, 0);
        GameSnapshotDto.Side side = timerOwnerSeat < 0 || timerOwnerSeat == seat
                ? GameSnapshotDto.Side.SELF : GameSnapshotDto.Side.OPPONENT;
        return new ServerMessage.Timer(side, settings.turnTimeout().toMillis(), Math.max(0, timerDeadline - clock.millis()));
    }

    private void hideTimer() {
        if (!timerVisible) return;
        timerVisible = false;
        seats.forEach(s -> s.send(new ServerMessage.Timer(null, 0, 0)));
    }

    private void sendError(int seat, String code) {
        seats.get(seat).send(new ServerMessage.ErrorMessage(code));
    }

    private void sendGameStarted(int seat) {
        seats.get(seat).send(new ServerMessage.GameStarted(id, profiles.get(seat), profiles.get(1 - seat),
                settings.turnTimeout().toMillis()));
    }

    private ServerMessage.GameOver gameOver(GameResult result, int seat) {
        String outcome = result.winnerSeat() == null ? "draw" : result.winnerSeat() == seat ? "win" : "lose";
        String reason = result.reason() == null ? null : result.reason().name().toLowerCase(Locale.ROOT);
        List<ServerMessage.RoundDto> rounds = result.rounds().stream().map(r -> round(r, seat)).toList();
        return new ServerMessage.GameOver(outcome, reason, rounds);
    }

    private static ServerMessage.RoundDto round(RoundResult round, int seat) {
        int self = seat == 0 ? round.scoreSeat0() : round.scoreSeat1();
        int opponent = seat == 0 ? round.scoreSeat1() : round.scoreSeat0();
        GameSnapshotDto.Side winner = round.winnerSeat() == null ? null
                : round.winnerSeat() == seat ? GameSnapshotDto.Side.SELF : GameSnapshotDto.Side.OPPONENT;
        return new ServerMessage.RoundDto(self, opponent, winner);
    }
}
