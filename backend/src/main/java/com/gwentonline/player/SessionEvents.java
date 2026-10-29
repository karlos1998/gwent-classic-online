package com.gwentonline.player;

/** Application events published by {@link SessionRegistry}; consumed by matchmaking and the game service. */
public final class SessionEvents {

    private SessionEvents() {
    }

    /** The player's connection was lost (the session itself stays until it expires). */
    public record Disconnected(GuestSession session) {
    }

    /** A connection was authenticated for the session (first connect, page reload, network back). */
    public record Connected(GuestSession session) {
    }

    /** The session is gone for good (expired or logged out); its nickname is free again. */
    public record Ended(GuestSession session) {
    }
}
