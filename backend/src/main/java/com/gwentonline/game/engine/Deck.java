package com.gwentonline.game.engine;

import java.util.random.RandomGenerator;

/** Shuffled draw pile. Its order never leaves the server. */
public final class Deck extends CardZone {

    private final RandomGenerator rng;

    Deck(RandomGenerator rng) {
        this.rng = rng;
    }

    /** Inserts at a random position (original {@code addCardRandom}). */
    @Override
    public void add(CardInstance card) {
        cards.add(card);
        int index = rng.nextInt(cards.size());
        if (index != cards.size() - 1) {
            CardInstance last = cards.getLast();
            cards.set(cards.size() - 1, cards.get(index));
            cards.set(index, last);
        }
    }

    public CardInstance top() {
        return cards.getFirst();
    }
}
