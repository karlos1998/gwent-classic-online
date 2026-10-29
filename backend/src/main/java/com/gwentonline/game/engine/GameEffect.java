package com.gwentonline.game.engine;

/** Deferred effect registered for game/round/turn hooks. Returning {@code true} removes it. */
@FunctionalInterface
interface GameEffect {
    boolean run();
}
