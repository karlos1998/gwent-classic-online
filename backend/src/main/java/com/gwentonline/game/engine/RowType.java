package com.gwentonline.game.engine;

import java.util.Arrays;
import java.util.Optional;

/** The three combat rows. {@link #key()} is the row name used by the card data. */
public enum RowType {
    CLOSE("close", "frost"),
    RANGED("ranged", "fog"),
    SIEGE("siege", "rain");

    private final String key;
    private final String weather;

    RowType(String key, String weather) {
        this.key = key;
        this.weather = weather;
    }

    public String key() {
        return key;
    }

    /** Weather ability that affects this row ({@code frost}, {@code fog}, {@code rain}). */
    public String weather() {
        return weather;
    }

    public static Optional<RowType> fromKey(String key) {
        return Arrays.stream(values()).filter(r -> r.key.equals(key)).findFirst();
    }

    public static Optional<RowType> fromWeather(String weather) {
        return Arrays.stream(values()).filter(r -> r.weather.equals(weather)).findFirst();
    }
}
