package com.gwentonline.matchmaking;

import com.gwentonline.game.engine.DeckSpec;
import com.gwentonline.player.GuestSession;
import com.gwentonline.protocol.PlayerProfileDto;

import java.time.Instant;

/** A player waiting for an opponent, with the (already validated) deck they want to play. */
public record SearchTicket(GuestSession session, DeckSpec deck, Instant since) {

    public PlayerProfileDto profile() {
        return session.profile();
    }
}
