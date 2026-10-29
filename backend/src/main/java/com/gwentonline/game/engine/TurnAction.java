package com.gwentonline.game.engine;

/** What a player does in their turn. */
public sealed interface TurnAction {

    record Pass() implements TurnAction {
    }

    record ActivateLeader() implements TurnAction {
    }

    /**
     * @param slot         target slot relative to the player (ignored for Scorch)
     * @param targetCardId card swapped by a Decoy, otherwise {@code null}
     */
    record PlayCard(int cardId, BoardSlot slot, Integer targetCardId) implements TurnAction {
    }
}
