package com.gwentonline.game.engine;

/** Discard pile in discard order. Public information. */
public final class Grave extends CardZone {

    /** Moves a card to the top of the pile (medic picks show the revived card on top). */
    void moveToTop(CardInstance card) {
        cards.remove(card);
        cards.add(card);
    }
}
