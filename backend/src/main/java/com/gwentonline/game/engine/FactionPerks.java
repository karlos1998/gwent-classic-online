package com.gwentonline.game.engine;

import java.util.List;

/** Faction abilities (port of the original {@code factions.js}). Nilfgaard's tie-break lives in {@link GwentGame#endRound}. */
final class FactionPerks {

    private final GwentGame game;

    FactionPerks(GwentGame game) {
        this.game = game;
    }

    void register(PlayerState player) {
        switch (player.getFaction()) {
            case REALMS -> game.onRoundStart(() -> northernRealms(player));
            case MONSTERS -> game.onRoundEnd(() -> monsters(player));
            case SCOIATAEL -> game.onGameStart(() -> scoiatael(player));
            case SKELLIGE -> game.onRoundStart(() -> skellige(player));
            case NILFGAARD -> { /* wins rounds that end in a draw */ }
        }
    }

    /** Draw a card whenever you win a round. */
    private boolean northernRealms(PlayerState player) {
        List<RoundResult> history = game.roundHistory();
        int round = game.roundCount();
        if (round > 1 && Integer.valueOf(player.getSeat()).equals(history.get(round - 2).winnerSeat())) {
            game.board().draw(player);
            game.notify(Notice.NORTH, player);
        }
        return false;
    }

    /** One random unit stays on the board after each round. */
    private boolean monsters(PlayerState player) {
        List<CardInstance> units = game.board().rowsOf(player)
                .flatMap(r -> r.cards().stream())
                .filter(CardInstance::isUnit)
                .toList();
        if (units.isEmpty()) return false;
        CardInstance kept = units.get(game.rng().nextInt(units.size()));
        kept.setNoRemove(true);
        game.onRoundStart(() -> {
            game.notify(Notice.MONSTERS, player);
            kept.setNoRemove(false);
            return true;
        });
        return false;
    }

    /** The Scoia'tael player decides who goes first. */
    private boolean scoiatael(PlayerState player) {
        boolean starts = game.decisions().chooseToStart(player);
        PlayerState first = starts ? player : player.getOpponent();
        game.setFirstPlayer(first);
        game.notify(Notice.FIRST, first, Audience.only(player));
        if (starts) game.notify(Notice.SCOIATAEL_CHOSE_SELF, player, Audience.except(player));
        else game.notify(Notice.FIRST, first, Audience.except(player));
        game.pacer().pause(Pacing.NOTIFICATION);
        return true;
    }

    /** Round 3: two random units come back from the graveyard. */
    private boolean skellige(PlayerState player) {
        if (game.roundCount() != 3) return false;
        PlayerState current = game.currentPlayer();
        game.setCurrentPlayer(player);
        game.notify(Notice.SKELLIGE, player);
        reviveRandomUnit(player);
        reviveRandomUnit(player);
        game.setCurrentPlayer(current);
        return true;
    }

    private void reviveRandomUnit(PlayerState player) {
        List<CardInstance> units = player.getGrave().findRandom(CardInstance::isUnit, 1, game.rng());
        if (units.isEmpty()) return;
        CardInstance card = units.getFirst();
        if (card.isAgile()) {
            RowType type = game.decisions().chooseAgileRow(player, card);
            game.board().moveTo(card, game.board().row(player, type), player.getGrave());
        } else {
            game.board().toRow(card, player.getGrave());
        }
    }
}
