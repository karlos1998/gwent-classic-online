package com.gwentonline.game.engine;

import java.util.EnumMap;
import java.util.Map;

/** Weather cards in play; a weather type is active while at least one of its cards is on the board. */
public final class WeatherZone extends CardZone {

    private final Map<RowType, Integer> active = new EnumMap<>(RowType.class);

    /** Increments the counter of a weather type, true if it just became active. */
    boolean activate(RowType type) {
        return active.merge(type, 1, Integer::sum) == 1;
    }

    /** Decrements the counter of a weather type, true if it just became inactive. */
    boolean deactivate(RowType type) {
        return active.merge(type, -1, Integer::sum) == 0;
    }

    public boolean isActive(RowType type) {
        return active.getOrDefault(type, 0) > 0;
    }

    /** New weather cards are shown first (original inserted at index 0). */
    void addFront(CardInstance card) {
        cards.addFirst(card);
    }

    void reset() {
        cards.clear();
        active.clear();
    }
}
