package com.gwentonline.game.engine;

/** A player's hand, kept sorted like the original client. */
public final class Hand extends CardZone {

    @Override
    public void add(CardInstance card) {
        addSorted(card);
    }

    /** Puts a card back at a given position (used by the mulligan so the carousel keeps its order). */
    void insertAt(int index, CardInstance card) {
        cards.add(Math.max(0, Math.min(index, cards.size())), card);
    }

    int indexOf(CardInstance card) {
        return cards.indexOf(card);
    }
}
