package com.gwentonline.game.engine;

import com.gwentonline.game.engine.card.CardCatalog;

import java.util.ArrayList;
import java.util.List;

/**
 * Card and leader abilities (port of the original {@code ability_dict}). Only the human code paths
 * of the original are needed - in online games both players are humans.
 */
final class CardEffects {

    private final GwentGame game;

    CardEffects(GwentGame game) {
        this.game = game;
    }

    private Board board() {
        return game.board();
    }

    // ------------------------------------------------------------------ placed

    void placed(String ability, CardInstance card, Row row) {
        switch (ability) {
            case "horn" -> game.animate(card, "horn");
            case "mardroeme" -> mardroeme(row);
            case "berserker" -> berserker(card, row);
            case "vildkarrl" -> vildkaarl(card);
            case "scorch" -> scorch(card, row);
            case "scorch_c" -> board().scorchRow(board().row(card.getHolder().getOpponent(), RowType.CLOSE));
            case "scorch_r" -> board().scorchRow(board().row(card.getHolder().getOpponent(), RowType.RANGED));
            case "scorch_s" -> board().scorchRow(board().row(card.getHolder().getOpponent(), RowType.SIEGE));
            case "muster" -> muster(card);
            case "spy" -> spy(card);
            case "medic" -> medic(card);
            case "morale" -> game.animate(card, "morale");
            case "bond" -> bond(card, row);
            default -> { /* leader passives are applied by GwentGame.initLeader */ }
        }
    }

    void removed(String ability, CardInstance card) {
        int summon = switch (ability) {
            case "avenger" -> CardCatalog.BOVINE_DEFENSE_FORCE;
            case "avenger_kambi" -> CardCatalog.HEMDALL;
            default -> -1;
        };
        if (summon < 0) return;
        CardInstance avenger = game.createCard(game.catalog().get(summon), card.getHolder());
        board().summon(avenger, board().rowFor(avenger, RowType.CLOSE, card.getHolder()), true);
    }

    private void mardroeme(Row row) {
        List<CardInstance> berserkers = row.findAll(c -> c.hasAbility("berserker"));
        game.pacer().parallel(berserkers.stream().<Runnable>map(c -> () -> berserker(c, row)).toList());
    }

    private void berserker(CardInstance card, Row row) {
        if (row.getMardroeme() == 0 || !row.contains(card)) return;
        board().removeFromRow(row, card);
        int bear = card.getName().contains("Young") ? CardCatalog.TRANSFORMED_YOUNG_VILDKAARL : CardCatalog.TRANSFORMED_VILDKAARL;
        board().addToRow(row, game.createCard(game.catalog().get(bear), card.getHolder()), false);
    }

    private void vildkaarl(CardInstance card) {
        if (!card.hasAbility("vildkarrl")) return;
        card.getAbilities().remove("vildkarrl");
        card.getPlacedAbilities().remove("vildkarrl");
        game.sound("mardroeme", null, Audience.EVERYONE);
        game.pacer().pause(Pacing.MARDROEME_SOUND);
    }

    /** Global scorch: destroys the strongest unit(s) on the whole battlefield. */
    void scorch(CardInstance scorchCard, Row ownRow) {
        record Target(Row row, CardInstance card) {
        }
        List<Row> rows = board().allRows().toList();
        int maxPower = 0;
        List<List<CardInstance>> maxByRow = new ArrayList<>();
        for (Row r : rows) {
            List<CardInstance> max = r.maxUnits().stream().filter(c -> c != scorchCard).toList();
            maxByRow.add(max);
            if (!max.isEmpty()) maxPower = Math.max(maxPower, max.getFirst().getPower());
        }
        List<Target> targets = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            List<CardInstance> max = maxByRow.get(i);
            if (!max.isEmpty() && max.getFirst().getPower() == maxPower) {
                Row row = rows.get(i);
                max.forEach(c -> targets.add(new Target(row, c)));
            }
        }
        if (targets.isEmpty()) return;
        game.pacer().parallel(targets.stream().<Runnable>map(t -> () -> game.animate(t.card(), "scorch")).toList());
        game.pacer().parallel(targets.stream().<Runnable>map(t -> () -> board().toGrave(t.card(), t.row())).toList());
    }

    private void muster(CardInstance card) {
        String cardName = card.getName();
        int dash = cardName.indexOf('-');
        if (dash >= 0) cardName = cardName.substring(0, dash);
        if (card.getDefinition().muster() != null) cardName = card.getDefinition().muster();
        String prefix = cardName;
        PlayerState holder = card.getHolder();
        record Source(CardZone zone, CardInstance card) {
        }
        List<Source> units = new ArrayList<>();
        holder.getHand().takeAll(c -> c.getName().startsWith(prefix)).forEach(c -> units.add(new Source(holder.getHand(), c)));
        holder.getDeck().takeAll(c -> c.getName().startsWith(prefix)).forEach(c -> units.add(new Source(holder.getDeck(), c)));
        if (units.isEmpty()) return;
        game.changed();
        game.animate(card, "muster");
        game.pacer().parallel(units.stream().<Runnable>map(u -> () -> {
            RowType type = RowType.fromKey(u.card().getRow()).orElse(RowType.CLOSE);
            board().summon(u.card(), board().rowFor(u.card(), type, u.card().getHolder()), true);
        }).toList());
    }

    private void spy(CardInstance card) {
        game.animate(card, "spy");
        PlayerState holder = card.getHolder();
        for (int i = 0; i < 2; i++) board().draw(holder);
        card.setHolder(holder.getOpponent());
        game.sound("draw", null, Audience.only(holder));
    }

    private void medic(CardInstance card) {
        PlayerState holder = card.getHolder();
        Grave grave = holder.getGrave();
        List<CardInstance> units = grave.findAll(CardInstance::isUnit);
        if (units.isEmpty()) return;
        CardInstance revived;
        if (game.isRandomRespawn()) {
            revived = grave.findRandom(CardInstance::isUnit, 1, game.rng()).getFirst();
        } else {
            revived = game.decisions().chooseCard(holder, ChoiceKind.MEDIC_REVIVE, sorted(units), false).orElse(units.getFirst());
        }
        grave.moveToTop(revived);
        game.changed();
        Row target = null;
        if (revived.isAgile()) target = board().row(holder, game.decisions().chooseAgileRow(holder, revived));
        game.animate(revived, "medic");
        if (target != null) board().moveTo(revived, target, grave);
        else board().toRow(revived, grave);
    }

    private void bond(CardInstance card, Row row) {
        List<CardInstance> bonds = row.findAll(c -> c.getName().equals(card.getName()));
        if (bonds.size() > 1) game.pacer().parallel(bonds.stream().<Runnable>map(c -> () -> game.animate(c, "bond")).toList());
    }

    // ------------------------------------------------------------------ leaders

    void activateLeader(PlayerState player) {
        CardInstance leader = player.getLeader();
        PlayerState opponent = player.getOpponent();
        switch (leader.getLeaderAbility()) {
            case "foltest_king" -> playFromDeck(player, "Impenetrable Fog");
            case "emhyr_imperial" -> playFromDeck(player, "Torrential Rain");
            case "francesca_pureblood" -> playFromDeck(player, "Biting Frost");
            case "foltest_lord" -> board().clearWeather();
            case "foltest_siegemaster" -> board().leaderHorn(board().row(player, RowType.SIEGE));
            case "eredin_commander" -> board().leaderHorn(board().row(player, RowType.CLOSE));
            case "francesca_beautiful" -> board().leaderHorn(board().row(player, RowType.RANGED));
            case "foltest_steelforged" -> board().scorchRow(board().row(opponent, RowType.SIEGE));
            case "foltest_son" -> board().scorchRow(board().row(opponent, RowType.RANGED));
            case "francesca_queen" -> board().scorchRow(board().row(opponent, RowType.CLOSE));
            case "emhyr_emperor" -> game.reveal(opponent.getHand().findRandom(c -> true, 3, game.rng()), "carousel.opponentHand", player);
            case "emhyr_relentless" -> takeFromGrave(player, opponent.getGrave(), ChoiceKind.LEADER_TAKE_FROM_OPPONENT_GRAVE);
            case "eredin_bringer_of_death" -> takeFromGrave(player, player.getGrave(), ChoiceKind.LEADER_RESTORE_FROM_GRAVE);
            case "eredin_destroyer" -> destroyer(player);
            case "eredin_king" -> weatherFromDeck(player);
            case "francesca_hope" -> francescaHope(player);
            case "crach_an_craite" -> crachAnCraite(player);
            default -> { /* passive leaders cannot be activated */ }
        }
    }

    private void playFromDeck(PlayerState player, String cardName) {
        player.getDeck().findLast(c -> c.isNamed(cardName)).ifPresent(c -> board().toRow(c, player.getDeck()));
    }

    private void takeFromGrave(PlayerState player, Grave grave, ChoiceKind kind) {
        List<CardInstance> units = grave.findAll(CardInstance::isUnit);
        if (units.isEmpty()) return;
        CardInstance chosen = game.decisions().chooseCard(player, kind, sorted(units), false).orElse(units.getFirst());
        chosen.setHolder(player);
        board().moveTo(chosen, player.getHand(), grave);
    }

    private void destroyer(PlayerState player) {
        for (int i = 0; i < 2 && !player.getHand().isEmpty(); i++) {
            List<CardInstance> hand = List.copyOf(player.getHand().cards());
            CardInstance discard = game.decisions().chooseCard(player, ChoiceKind.LEADER_DISCARD, hand, false).orElse(hand.getFirst());
            board().toGrave(discard, player.getHand());
        }
        if (player.getDeck().isEmpty()) return;
        List<CardInstance> deck = sorted(player.getDeck().cards());
        CardInstance drawn = game.decisions().chooseCard(player, ChoiceKind.LEADER_DRAW_FROM_DECK, deck, false).orElse(deck.getFirst());
        board().toHand(drawn, player.getDeck());
    }

    private void weatherFromDeck(PlayerState player) {
        List<CardInstance> weather = sorted(player.getDeck().findAll(CardInstance::isWeather));
        if (weather.isEmpty()) return;
        CardInstance chosen = game.decisions().chooseCard(player, ChoiceKind.LEADER_WEATHER_FROM_DECK, weather, false).orElse(weather.getFirst());
        board().moveTo(chosen, board().weather(), player.getDeck());
    }

    private void crachAnCraite(PlayerState player) {
        game.sound("redraw", null, Audience.EVERYONE);
        PlayerState opponent = player.getOpponent();
        List<Runnable> moves = new ArrayList<>();
        for (PlayerState p : List.of(player, opponent)) {
            for (CardInstance c : List.copyOf(p.getGrave().cards())) moves.add(() -> board().toDeck(c, p.getGrave()));
        }
        game.pacer().parallel(moves);
    }

    /** Francesca "Hope of the Aen Seidhe": moves agile units to the row where they are strongest. */
    private void francescaHope(PlayerState player) {
        Row close = board().row(player, RowType.CLOSE);
        Row ranged = board().row(player, RowType.RANGED);
        List<CardInstance> agile = new ArrayList<>(close.findAll(CardInstance::isAgile));
        agile.addAll(ranged.findAll(CardInstance::isAgile));
        if (agile.isEmpty()) return;
        Row closeBase = close.virtualCopy(c -> !c.isAgile());
        Row rangedBase = ranged.virtualCopy(c -> !c.isAgile());
        int[] best = bestPattern(closeBase, rangedBase, agile);
        List<Runnable> moves = new ArrayList<>();
        for (int i = 0; i < agile.size(); i++) {
            CardInstance card = agile.get(i);
            boolean inClose = close.contains(card);
            boolean wantsClose = best[i] == 0;
            if (inClose != wantsClose) {
                Row from = inClose ? close : ranged;
                Row to = inClose ? ranged : close;
                moves.add(() -> board().moveTo(card, to, from));
            }
        }
        game.pacer().parallel(moves);
    }

    private int[] bestPattern(Row close, Row ranged, List<CardInstance> agile) {
        int n = agile.size();
        int base = close.calcScore(game.isDoubleSpyPower()) + ranged.calcScore(game.isDoubleSpyPower());
        int bestScore = Integer.MIN_VALUE;
        int[] best = new int[n];
        for (int mask = 0; mask < (1 << n); mask++) {
            Row c = close.virtualCopy(x -> true);
            Row r = ranged.virtualCopy(x -> true);
            int[] pattern = new int[n];
            for (int i = 0; i < n; i++) {
                pattern[i] = (mask >> (n - 1 - i)) & 1;
                Row target = pattern[i] == 0 ? c : r;
                target.cards.add(agile.get(i));
                target.updateState(agile.get(i), true);
            }
            int score = c.calcScore(game.isDoubleSpyPower()) + r.calcScore(game.isDoubleSpyPower()) - base;
            // ">" keeps the first best pattern in the same enumeration order as the original recursion
            if (score > bestScore) {
                bestScore = score;
                best = pattern;
            }
        }
        return best;
    }

    private static List<CardInstance> sorted(List<CardInstance> cards) {
        return cards.stream().sorted(CardInstance.ORDER).toList();
    }
}
