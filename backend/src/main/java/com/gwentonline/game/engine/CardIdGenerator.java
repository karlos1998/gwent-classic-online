package com.gwentonline.game.engine;

import java.util.HashSet;
import java.util.Set;
import java.util.random.RandomGenerator;

/**
 * Random, unique card ids per game. Ids are opaque on purpose: sequential ids assigned in deck-list order
 * would let a client infer which card is which before it is revealed.
 */
final class CardIdGenerator {

    private final RandomGenerator rng;
    private final Set<Integer> used = new HashSet<>();

    CardIdGenerator(RandomGenerator rng) {
        this.rng = rng;
    }

    int next() {
        int id;
        do {
            id = rng.nextInt(1, Integer.MAX_VALUE);
        } while (!used.add(id));
        return id;
    }
}
