package com.gwentonline.game.engine;

import java.util.List;

/** Visual / audio effects emitted by the engine in addition to state changes. */
public sealed interface GameEvent {

    Audience audience();

    /** Banner notification, see {@link Notice}. */
    record Notification(Notice notice, PlayerState subject, Audience audience) implements GameEvent {
    }

    /** Ability animation on a card that is visible on the board ({@code horn}, {@code scorch}, {@code medic} ...). */
    record CardAnimation(CardInstance card, String animation, Audience audience) implements GameEvent {
    }

    /** Big preview of the card the opponent is about to play. */
    record CardPreview(CardInstance card, long durationMs, Audience audience) implements GameEvent {
    }

    /** Sound effect; {@code key} may be relative ({@code turn}, {@code round_result}, {@code game_result}). */
    record Sound(String key, PlayerState subject, Audience audience) implements GameEvent {
    }

    /** Cards revealed to a single player (Emhyr "Emperor of Nilfgaard" looks at the opponent's hand). */
    record Reveal(List<CardInstance> cards, String titleKey, Audience audience) implements GameEvent {
    }
}
