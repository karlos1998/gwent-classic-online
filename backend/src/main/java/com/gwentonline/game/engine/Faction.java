package com.gwentonline.game.engine;

import java.util.Arrays;
import java.util.Optional;

/** Playable factions. {@link #key()} matches the {@code deck} field of the card data. */
public enum Faction {
    REALMS("realms"),
    NILFGAARD("nilfgaard"),
    MONSTERS("monsters"),
    SCOIATAEL("scoiatael"),
    SKELLIGE("skellige");

    private final String key;

    Faction(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }

    public static Optional<Faction> fromKey(String key) {
        return Arrays.stream(values()).filter(f -> f.key.equals(key)).findFirst();
    }
}
