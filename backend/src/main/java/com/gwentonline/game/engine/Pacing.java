package com.gwentonline.game.engine;

/**
 * Pauses between game steps so that both clients have time to play the same animations as the
 * offline game (durations taken from the original client). Scaled by {@code gwent.game.pacing-factor}.
 */
public enum Pacing {
    FLIGHT(500),
    PLACEMENT_SOUND(1000),
    PLACED(600),
    NOTIFICATION(1200),
    PREVIEW(1000),
    LEADER_PREVIEW(1500),
    ANIMATION(1650),
    WEATHER(1000),
    WEATHER_DUPLICATE(750),
    CLEAR_WEATHER(500),
    MARDROEME_SOUND(1000),
    SHORT(300);

    private final long millis;

    Pacing(long millis) {
        this.millis = millis;
    }

    public long millis() {
        return millis;
    }
}
