package com.gwentonline.game.engine.card;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Objects;

/**
 * All 216 card definitions (base game + Hearts of Stone + Blood and Wine), loaded from {@code game/cards.json}.
 * The file is generated from the web client's card data, so indices are identical on both sides.
 */
public final class CardCatalog {

    public static final String RESOURCE = "/game/cards.json";

    /** Special cards referenced by abilities (indices as in the original game data). */
    public static final int COMMANDERS_HORN = 5;
    public static final int BOVINE_DEFENSE_FORCE = 21;
    public static final int HEMDALL = 196;
    public static final int TRANSFORMED_VILDKAARL = 206;
    public static final int TRANSFORMED_YOUNG_VILDKAARL = 207;

    private final List<CardDefinition> cards;

    private CardCatalog(List<CardDefinition> cards) {
        this.cards = List.copyOf(cards);
        verify(COMMANDERS_HORN, "Commander's Horn");
        verify(BOVINE_DEFENSE_FORCE, "Bovine Defense Force");
        verify(HEMDALL, "Hemdall");
        verify(TRANSFORMED_VILDKAARL, "Transformed Vildkaarl");
        verify(TRANSFORMED_YOUNG_VILDKAARL, "Transformed Young Vildkaarl");
    }

    public static CardCatalog loadDefault() {
        try (InputStream in = Objects.requireNonNull(CardCatalog.class.getResourceAsStream(RESOURCE), RESOURCE)) {
            List<CardDefinition> defs = new ObjectMapper().readValue(in, new TypeReference<>() {});
            return new CardCatalog(defs);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot load card catalog " + RESOURCE, e);
        }
    }

    public CardDefinition get(int index) {
        if (index < 0 || index >= cards.size()) {
            throw new IllegalArgumentException("Unknown card index " + index);
        }
        return cards.get(index);
    }

    public boolean exists(int index) {
        return index >= 0 && index < cards.size();
    }

    public List<CardDefinition> all() {
        return cards;
    }

    public List<CardDefinition> leadersOf(String faction) {
        return cards.stream().filter(c -> c.isLeader() && c.deck().equals(faction)).toList();
    }

    private void verify(int index, String expectedName) {
        if (!get(index).name().equals(expectedName)) {
            throw new IllegalStateException("Card catalog mismatch at " + index + ": expected " + expectedName);
        }
    }
}
