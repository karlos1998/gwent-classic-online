package com.gwentonline.game.engine.card;

import java.util.List;
import java.util.Set;

/**
 * Immutable card definition, 1:1 with an entry of the original {@code card_dict}.
 * The {@code index} is the position in the catalog and is shared with the web client.
 *
 * @param deck faction key ({@code realms}, {@code nilfgaard}, ...) or {@code neutral}, {@code special}, {@code weather}
 * @param row  {@code close}, {@code ranged}, {@code siege}, {@code agile}, {@code leader} or empty for specials
 */
public record CardDefinition(
        int index,
        String name,
        String deck,
        String row,
        int strength,
        List<String> abilities,
        String filename,
        int count,
        String muster) {

    private static final Set<String> COMBAT_ROWS = Set.of("close", "ranged", "siege", "agile");

    public CardDefinition {
        abilities = List.copyOf(abilities);
    }

    public boolean isLeader() {
        return "leader".equals(row);
    }

    public boolean isWeather() {
        return "weather".equals(deck);
    }

    public boolean isSpecialOrWeather() {
        return "special".equals(deck) || "weather".equals(deck);
    }

    public boolean isHero() {
        return abilities.contains("hero");
    }

    public boolean isCombat() {
        return COMBAT_ROWS.contains(row);
    }
}
