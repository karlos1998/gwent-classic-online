package com.gwentonline.game.engine;

import com.gwentonline.game.engine.card.CardCatalog;
import com.gwentonline.game.engine.card.CardDefinition;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Server-side deck validation. The client validates too, but only this check counts: a modified
 * client must not be able to bring illegal cards, too many copies or an other faction's leader.
 */
public final class DeckValidator {

    /** Hard cap to protect the server from absurd payloads (the real maximum is far lower). */
    public static final int MAX_CARDS = 120;

    private final CardCatalog catalog;

    public DeckValidator(CardCatalog catalog) {
        this.catalog = catalog;
    }

    /** @return validation error codes, empty if the deck is legal */
    public List<String> validate(DeckSpec deck) {
        List<String> errors = new ArrayList<>();
        if (deck == null) return List.of("deck.missing");
        if (Faction.fromKey(deck.faction()).isEmpty()) errors.add("deck.faction.unknown");
        if (!catalog.exists(deck.leader())) {
            errors.add("deck.leader.unknown");
        } else {
            CardDefinition leader = catalog.get(deck.leader());
            if (!leader.isLeader()) errors.add("deck.leader.notLeader");
            else if (!leader.deck().equals(deck.faction())) errors.add("deck.leader.wrongFaction");
        }
        int units = 0;
        int specials = 0;
        int total = 0;
        Set<Integer> seen = new HashSet<>();
        for (DeckSpec.Entry entry : deck.cards()) {
            if (entry == null || !catalog.exists(entry.index())) {
                errors.add("deck.card.unknown");
                continue;
            }
            if (!seen.add(entry.index())) errors.add("deck.card.duplicateEntry");
            CardDefinition card = catalog.get(entry.index());
            if (card.isLeader()) errors.add("deck.card.leaderInDeck");
            if (!allowedIn(card, deck.faction())) errors.add("deck.card.wrongFaction");
            if (entry.count() < 1 || entry.count() > card.count()) errors.add("deck.card.tooManyCopies");
            int count = Math.max(0, Math.min(entry.count(), card.count()));
            total += count;
            if (card.isSpecialOrWeather()) specials += count;
            else units += count;
        }
        if (total > MAX_CARDS) errors.add("deck.tooLarge");
        if (units < GameRules.MIN_UNIT_CARDS) errors.add("deck.notEnoughUnits");
        if (specials > GameRules.MAX_SPECIAL_CARDS) errors.add("deck.tooManySpecials");
        return errors.stream().distinct().toList();
    }

    private static boolean allowedIn(CardDefinition card, String faction) {
        return card.deck().equals(faction) || card.deck().equals("neutral")
                || card.deck().equals("special") || card.deck().equals("weather");
    }
}
