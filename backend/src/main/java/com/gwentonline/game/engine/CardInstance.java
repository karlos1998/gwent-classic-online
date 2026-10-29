package com.gwentonline.game.engine;

import com.gwentonline.game.engine.card.CardDefinition;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** A physical card in a running game (port of the original {@code Card} class). */
@Getter
public final class CardInstance {

    /** Sort order of hands and rows: specials, weather, then units by power and name. */
    public static final Comparator<CardInstance> ORDER = Comparator
            .comparingInt(CardInstance::factionRank)
            .thenComparingInt(CardInstance::getBasePower)
            .thenComparing(CardInstance::getName);

    private final int id;
    private final CardDefinition definition;
    private final String name;
    private final String faction;
    /** close | ranged | siege | agile | weather | leader | "" */
    private final String row;
    private final boolean hero;
    private final int basePower;
    /** abilities without "hero"; mutable because vildkaarl drops its own ability after the first trigger */
    private final List<String> abilities;
    private final List<String> placedAbilities = new ArrayList<>();
    private final List<String> removedAbilities = new ArrayList<>();
    private final List<Runnable> removedHooks = new ArrayList<>();
    private final String leaderAbility;

    @Setter
    private int power;
    @Setter
    private PlayerState holder;
    @Setter
    private boolean noRemove;

    CardInstance(int id, CardDefinition definition, PlayerState holder) {
        this.id = id;
        this.definition = definition;
        this.name = definition.name();
        this.faction = definition.deck();
        this.row = definition.isWeather() ? "weather" : definition.row();
        this.basePower = definition.strength();
        this.power = basePower;
        this.holder = holder;
        List<String> list = new ArrayList<>(definition.abilities());
        this.hero = !list.isEmpty() && "hero".equals(list.getFirst());
        if (hero) {
            list.removeFirst();
        }
        this.abilities = list;
        for (String ability : list) {
            if (Abilities.ON_PLACED.contains(ability)) placedAbilities.add(ability);
            if (Abilities.ON_REMOVED.contains(ability)) removedAbilities.add(ability);
        }
        this.leaderAbility = definition.isLeader() && !list.isEmpty() ? list.getFirst() : null;
    }

    public int getIndex() {
        return definition.index();
    }

    public boolean hasAbility(String ability) {
        return abilities.contains(ability);
    }

    /** A combat card that is not a hero. */
    public boolean isUnit() {
        return !hero && ("close".equals(row) || "ranged".equals(row) || "siege".equals(row) || "agile".equals(row));
    }

    /** Cards that go to a row's special slot. */
    public boolean isSpecial() {
        return "Commander's Horn".equals(name) || "Mardroeme".equals(name);
    }

    public boolean isWeather() {
        return "weather".equals(row);
    }

    public boolean isAgile() {
        return "agile".equals(row);
    }

    public boolean isNamed(String cardName) {
        return name.equals(cardName);
    }

    /** True if a leader ability can be activated (passive leaders cannot). */
    public boolean isActivatableLeader() {
        return leaderAbility != null && Abilities.LEADER_ACTIVATED.contains(leaderAbility);
    }

    void resetPower() {
        if (!isNamed("Decoy")) power = basePower;
    }

    private static int factionRank(CardInstance card) {
        return switch (card.faction) {
            case "special" -> -2;
            case "weather" -> -1;
            default -> 0;
        };
    }

    @Override
    public String toString() {
        return name + "#" + id;
    }
}
