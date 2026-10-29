package com.gwentonline.player;

import com.gwentonline.protocol.PlayerProfileDto;
import com.gwentonline.protocol.ServerMessage;
import com.gwentonline.transport.ClientConnection;
import lombok.Getter;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

/**
 * A guest player identified by a secret token. Lives in memory only; it survives short disconnects
 * (page reload, network hiccup) so a player can return to a running game.
 */
public final class GuestSession {

    @Getter
    private final String id;
    /** secret, never logged or sent to other players */
    private final String token;
    @Getter
    private final String nickname;
    @Getter
    private final Instant createdAt;
    private final AtomicReference<PlayerStatus> status = new AtomicReference<>(PlayerStatus.IDLE);
    @Getter
    private volatile ClientConnection connection;
    @Getter
    private volatile Instant lastSeen;

    GuestSession(String id, String token, String nickname, Instant createdAt) {
        this.id = id;
        this.token = token;
        this.nickname = nickname;
        this.createdAt = createdAt;
        this.lastSeen = createdAt;
    }

    public PlayerProfileDto profile() {
        return PlayerProfileDto.guest(nickname);
    }

    public PlayerStatus status() {
        return status.get();
    }

    /** Atomic state change; false if the session was not in the expected state. */
    public boolean transition(PlayerStatus expected, PlayerStatus next) {
        return status.compareAndSet(expected, next);
    }

    public void setStatus(PlayerStatus next) {
        status.set(next);
    }

    public boolean isConnected() {
        ClientConnection c = connection;
        return c != null && c.isOpen();
    }

    /** Sends if connected; messages for a disconnected player are dropped (state is resent on reconnect). */
    public void send(ServerMessage message) {
        ClientConnection c = connection;
        if (c != null) c.send(message);
    }

    /** Secret of this session - only returned once to its owner. */
    public String token() {
        return token;
    }

    void attach(ClientConnection connection, Instant now) {
        this.connection = connection;
        this.lastSeen = now;
    }

    boolean detach(ClientConnection connection, Instant now) {
        if (this.connection != connection) return false;
        this.connection = null;
        this.lastSeen = now;
        return true;
    }

    @Override
    public String toString() {
        return "Guest[" + nickname + "]";
    }
}
