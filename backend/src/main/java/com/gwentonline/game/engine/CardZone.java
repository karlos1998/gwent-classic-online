package com.gwentonline.game.engine;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.random.RandomGenerator;

/** Ordered collection of cards (port of the original {@code CardContainer}). */
public class CardZone {

    protected final List<CardInstance> cards = new ArrayList<>();

    public List<CardInstance> cards() {
        return Collections.unmodifiableList(cards);
    }

    public int size() {
        return cards.size();
    }

    public boolean isEmpty() {
        return cards.isEmpty();
    }

    public boolean contains(CardInstance card) {
        return cards.contains(card);
    }

    public Optional<CardInstance> byId(int id) {
        return cards.stream().filter(c -> c.getId() == id).findFirst();
    }

    /** Last card matching the predicate (same search order as the original). */
    public Optional<CardInstance> findLast(Predicate<CardInstance> predicate) {
        for (int i = cards.size() - 1; i >= 0; --i) {
            if (predicate.test(cards.get(i))) return Optional.of(cards.get(i));
        }
        return Optional.empty();
    }

    public List<CardInstance> findAll(Predicate<CardInstance> predicate) {
        return cards.stream().filter(predicate).toList();
    }

    /** Up to {@code n} distinct random cards matching the predicate, the zone itself is not modified. */
    public List<CardInstance> findRandom(Predicate<CardInstance> predicate, int n, RandomGenerator rng) {
        List<CardInstance> valid = new ArrayList<>(cards.stream().filter(predicate).toList());
        List<CardInstance> out = new ArrayList<>();
        for (int i = Math.min(n, valid.size()); i > 0; --i) {
            out.add(valid.remove(rng.nextInt(valid.size())));
        }
        return out;
    }

    /** Removes and returns every card matching the predicate. */
    public List<CardInstance> takeAll(Predicate<CardInstance> predicate) {
        List<CardInstance> taken = new ArrayList<>(cards.stream().filter(predicate).toList());
        Collections.reverse(taken);
        taken.forEach(this::remove);
        return taken;
    }

    public void add(CardInstance card) {
        cards.add(card);
    }

    public void remove(CardInstance card) {
        if (!cards.remove(card)) {
            throw new IllegalStateException(card + " is not in " + getClass().getSimpleName());
        }
    }

    public void clear() {
        cards.clear();
    }

    protected void addSorted(CardInstance card) {
        int i = 0;
        while (i < cards.size() && CardInstance.ORDER.compare(card, cards.get(i)) >= 0) i++;
        cards.add(i, card);
    }
}
