package com.gwentonline.game.engine;

/** Reasons the engine asks a player to pick a card. Used by the client for titles. */
public enum ChoiceKind {
    MEDIC_REVIVE,
    LEADER_TAKE_FROM_OPPONENT_GRAVE,
    LEADER_RESTORE_FROM_GRAVE,
    LEADER_DISCARD,
    LEADER_DRAW_FROM_DECK,
    LEADER_WEATHER_FROM_DECK
}
