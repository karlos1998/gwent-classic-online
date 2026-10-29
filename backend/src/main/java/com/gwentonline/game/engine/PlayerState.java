package com.gwentonline.game.engine;

import lombok.Getter;
import lombok.Setter;

/** Everything the engine knows about one player during a game. */
@Getter
public final class PlayerState {

    private final int seat;
    private final String nickname;
    private final Faction faction;
    private final Deck deck;
    private final Hand hand = new Hand();
    private final Grave grave = new Grave();
    @Setter
    private CardInstance leader;
    @Setter
    private LeaderState leaderState = LeaderState.PASSIVE;
    @Setter
    private int health = GameRules.LIVES;
    @Setter
    private int total;
    @Setter
    private boolean passed;
    @Setter
    private boolean winning;
    @Setter
    private PlayerState opponent;

    PlayerState(int seat, String nickname, Faction faction, Deck deck) {
        this.seat = seat;
        this.nickname = nickname;
        this.faction = faction;
        this.deck = deck;
    }

    public boolean isLeaderAvailable() {
        return leaderState == LeaderState.AVAILABLE;
    }

    /** True if the player can do anything besides passing. */
    public boolean canPlay() {
        return !hand.isEmpty() || isLeaderAvailable();
    }

    void addToTotal(int delta) {
        total += delta;
    }

    @Override
    public String toString() {
        return "P" + seat + "(" + nickname + ")";
    }
}
