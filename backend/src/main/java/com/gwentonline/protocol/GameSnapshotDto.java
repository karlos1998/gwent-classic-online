package com.gwentonline.protocol;

import java.util.List;

/**
 * Complete board as seen by ONE player. Built separately for each recipient: the opponent's hand and both
 * decks are reduced to counts, so hidden information never leaves the server.
 *
 * @param rows  six rows in client order: opponent siege, ranged, close, then own close, ranged, siege
 * @param turn  whose turn it is from the recipient's point of view, {@code null} between turns
 */
public record GameSnapshotDto(
        long version,
        int round,
        Side turn,
        PlayerViewDto self,
        PlayerViewDto opponent,
        List<RowDto> rows,
        List<CardDto> weather) {

    public enum Side { SELF, OPPONENT }

    /** @param hand only filled for the recipient, {@code null} for the opponent */
    public record PlayerViewDto(
            PlayerProfileDto profile,
            String faction,
            CardDto leader,
            String leaderState,
            int health,
            int total,
            boolean passed,
            boolean winning,
            int handCount,
            int deckCount,
            List<CardDto> hand,
            List<CardDto> grave) {
    }

    public record RowDto(String type, int total, boolean weather, CardDto special, List<CardDto> cards) {
    }
}
