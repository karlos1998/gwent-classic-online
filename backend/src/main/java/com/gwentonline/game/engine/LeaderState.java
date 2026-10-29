package com.gwentonline.game.engine;

/** Visible state of a leader card. */
public enum LeaderState {
    /** can be activated (once per game) */
    AVAILABLE,
    /** passive leader ability, nothing to activate */
    PASSIVE,
    /** already used or cancelled by Emhyr "the White Flame" */
    USED
}
