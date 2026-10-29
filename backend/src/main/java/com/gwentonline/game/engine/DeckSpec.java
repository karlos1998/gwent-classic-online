package com.gwentonline.game.engine;

import java.util.List;

/**
 * A deck as submitted by a client: faction, leader card index and (card index, count) pairs.
 * Validate with {@link DeckValidator} before starting a game.
 */
public record DeckSpec(String faction, int leader, List<Entry> cards) {

    public DeckSpec {
        cards = cards == null ? List.of() : List.copyOf(cards);
    }

    public record Entry(int index, int count) {
    }
}
