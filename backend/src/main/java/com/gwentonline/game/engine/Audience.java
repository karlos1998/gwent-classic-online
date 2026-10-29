package com.gwentonline.game.engine;

/**
 * Who may receive an event. Anything that reveals hidden information (a player's hand or deck)
 * must target {@link #only(PlayerState)} - this is the main guard against data leaks.
 */
public sealed interface Audience {

    Audience EVERYONE = new Everyone();

    boolean includes(PlayerState player);

    static Audience only(PlayerState player) {
        return new Only(player);
    }

    static Audience except(PlayerState player) {
        return new Except(player);
    }

    record Everyone() implements Audience {
        @Override
        public boolean includes(PlayerState player) {
            return true;
        }
    }

    record Only(PlayerState player) implements Audience {
        @Override
        public boolean includes(PlayerState p) {
            return p == player;
        }
    }

    record Except(PlayerState player) implements Audience {
        @Override
        public boolean includes(PlayerState p) {
            return p != player;
        }
    }
}
