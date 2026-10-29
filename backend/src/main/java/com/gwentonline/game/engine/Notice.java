package com.gwentonline.game.engine;

/**
 * Game notifications (the banner in the middle of the board). They are relative to a {@code subject}
 * player and translated per recipient, e.g. {@link #TURN} becomes "me-turn" for the subject and
 * "op-turn" for the opponent.
 */
public enum Notice {
    COIN,
    FIRST,
    /** subject used the Scoia'tael perk and chose to start */
    SCOIATAEL_CHOSE_SELF,
    ROUND_START,
    TURN,
    PASS,
    /** subject won the round (null subject = draw) */
    ROUND_RESULT,
    NORTH,
    MONSTERS,
    SKELLIGE
}
