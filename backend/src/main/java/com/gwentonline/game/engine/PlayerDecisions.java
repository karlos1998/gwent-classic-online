package com.gwentonline.game.engine;

import java.util.List;
import java.util.Optional;

/**
 * Input port of the engine: blocking requests for player decisions. Implementations enforce timeouts
 * and must return a legal default when a player does not answer in time.
 */
public interface PlayerDecisions {

    /** Next action of the player whose turn it is. Must be validated with {@link GwentGame#validate}. */
    TurnAction awaitTurn(PlayerState player);

    /** Pick one card from {@code options} (never empty). Empty result only if {@code cancellable}. */
    Optional<CardInstance> chooseCard(PlayerState player, ChoiceKind kind, List<CardInstance> options, boolean cancellable);

    /** Row for an agile card that is put on the board by an ability. */
    RowType chooseAgileRow(PlayerState player, CardInstance card);

    /** Scoia'tael perk: true = the player starts. */
    boolean chooseToStart(PlayerState player);

    /**
     * Initial redraw of both players, in parallel. The implementation calls {@link Mulligan#swap} for each
     * chosen card (at most {@link GameRules#MULLIGAN_SWAPS} per player) and returns when both are done.
     */
    void mulligan(Mulligan mulligan);

    /** Handle for the parallel mulligan phase. */
    interface Mulligan {
        List<PlayerState> players();

        int remaining(PlayerState player);

        /** Swaps the card with the top of the deck, returns false if not allowed. */
        boolean swap(PlayerState player, int cardId);

        void finish(PlayerState player);

        boolean isFinished(PlayerState player);
    }
}
