package com.gwentonline.matchmaking;

import com.gwentonline.player.GuestSession;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** A proposed match waiting for both players to accept. Guarded by the matchmaking lock. */
final class PendingMatch {

    private final String id;
    private final SearchTicket first;
    private final SearchTicket second;
    private final Instant expiresAt;
    private final Set<GuestSession> accepted = new HashSet<>();

    PendingMatch(String id, SearchTicket first, SearchTicket second, Instant expiresAt) {
        this.id = id;
        this.first = first;
        this.second = second;
        this.expiresAt = expiresAt;
    }

    String id() {
        return id;
    }

    SearchTicket first() {
        return first;
    }

    SearchTicket second() {
        return second;
    }

    Instant expiresAt() {
        return expiresAt;
    }

    List<SearchTicket> sides() {
        return List.of(first, second);
    }

    boolean involves(GuestSession session) {
        return first.session() == session || second.session() == session;
    }

    SearchTicket opponentOf(GuestSession session) {
        return first.session() == session ? second : first;
    }

    void accept(GuestSession session) {
        accepted.add(session);
    }

    boolean hasAccepted(GuestSession session) {
        return accepted.contains(session);
    }

    boolean hasAccepted(SearchTicket ticket) {
        return accepted.contains(ticket.session());
    }

    boolean bothAccepted() {
        return accepted.size() == 2;
    }
}
