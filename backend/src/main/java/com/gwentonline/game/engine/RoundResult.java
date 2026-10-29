package com.gwentonline.game.engine;

/** Score of a finished round; {@code winnerSeat} is {@code null} for a draw. */
public record RoundResult(Integer winnerSeat, int scoreSeat0, int scoreSeat1) {
}
