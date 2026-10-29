package com.gwentonline.game.engine;

import java.util.List;

/**
 * Outcome of a game.
 *
 * @param winnerSeat {@code null} for a draw
 * @param reason     {@code null} when the game ended normally
 */
public record GameResult(Integer winnerSeat, List<RoundResult> rounds, GameTerminatedException.Reason reason) {

    public GameResult {
        rounds = List.copyOf(rounds);
    }
}
