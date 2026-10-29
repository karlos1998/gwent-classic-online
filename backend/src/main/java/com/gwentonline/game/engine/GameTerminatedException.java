package com.gwentonline.game.engine;

/** Ends a game early (surrender, disconnect). Thrown from inside {@link PlayerDecisions}. */
public final class GameTerminatedException extends RuntimeException {

    public enum Reason { SURRENDER, DISCONNECT, SERVER_SHUTDOWN }

    private final transient PlayerState loser;
    private final Reason reason;

    public GameTerminatedException(PlayerState loser, Reason reason) {
        super(reason + " by " + loser, null, false, false);
        this.loser = loser;
        this.reason = reason;
    }

    public PlayerState loser() {
        return loser;
    }

    public Reason reason() {
        return reason;
    }
}
