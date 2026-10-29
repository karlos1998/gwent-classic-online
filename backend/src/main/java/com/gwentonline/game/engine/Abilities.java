package com.gwentonline.game.engine;

import java.util.Set;

/** Ability keys as used in the card data, grouped by when they trigger. */
public final class Abilities {

    /** Abilities with an effect when the card is placed on the board (original {@code placed} handlers). */
    public static final Set<String> ON_PLACED = Set.of(
            "horn", "mardroeme", "berserker", "vildkarrl", "scorch", "scorch_c", "scorch_r", "scorch_s",
            "muster", "spy", "medic", "morale", "bond", "francesca_daisy", "king_bran");

    /** Abilities with an effect when the card leaves the board. */
    public static final Set<String> ON_REMOVED = Set.of("avenger", "avenger_kambi");

    /** Leader abilities that are activated once per game. */
    public static final Set<String> LEADER_ACTIVATED = Set.of(
            "foltest_king", "foltest_lord", "foltest_siegemaster", "foltest_steelforged", "foltest_son",
            "emhyr_imperial", "emhyr_emperor", "emhyr_relentless",
            "eredin_commander", "eredin_bringer_of_death", "eredin_destroyer", "eredin_king",
            "francesca_queen", "francesca_beautiful", "francesca_pureblood", "francesca_hope",
            "crach_an_craite");

    public static final Set<String> WEATHER_TYPES = Set.of("rain", "fog", "frost");

    private Abilities() {
    }
}
