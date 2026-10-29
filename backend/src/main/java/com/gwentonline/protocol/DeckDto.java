package com.gwentonline.protocol;

import java.util.List;

/** Deck submitted when searching for a match (same content as the web client's deck JSON). */
public record DeckDto(String faction, int leader, List<Entry> cards) {

    public static final int MAX_ENTRIES = 250;

    public DeckDto {
        if (faction == null || faction.length() > 32) throw new IllegalArgumentException("faction");
        if (cards == null || cards.size() > MAX_ENTRIES) throw new IllegalArgumentException("cards");
        cards = List.copyOf(cards);
    }

    public record Entry(int index, int count) {
    }
}
