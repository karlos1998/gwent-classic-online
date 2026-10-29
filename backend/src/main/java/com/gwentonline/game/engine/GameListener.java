package com.gwentonline.game.engine;

/** Output port of the engine. Implemented by the game room, which builds per-player views. */
public interface GameListener {

    /** Something on the board changed; the next {@link #pause} or event flushes a new snapshot. */
    void stateChanged();

    void onEvent(GameEvent event);

    /** Lets clients finish animations; the engine thread sleeps here. */
    void pause(long millis);

    GameListener NONE = new GameListener() {
        @Override
        public void stateChanged() {
        }

        @Override
        public void onEvent(GameEvent event) {
        }

        @Override
        public void pause(long millis) {
        }
    };
}
