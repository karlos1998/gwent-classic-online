package com.gwentonline.transport;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.gwentonline.common.TokenBucket;
import com.gwentonline.player.GuestSession;
import com.gwentonline.protocol.ServerMessage;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * One browser connection. Wraps a {@code ConcurrentWebSocketSessionDecorator}, so sending is thread-safe
 * and a slow client is disconnected instead of blocking the game thread.
 */
@Slf4j
public final class ClientConnection {

    public static final CloseStatus REPLACED = new CloseStatus(4001, "Session opened in another tab");
    public static final CloseStatus AUTH_FAILED = new CloseStatus(4003, "Authentication failed");
    public static final CloseStatus AUTH_TIMEOUT = new CloseStatus(4008, "Authentication timeout");
    public static final CloseStatus RATE_LIMITED = new CloseStatus(4029, "Too many messages");

    private final WebSocketSession session;
    private final ObjectWriter writer;
    private final TokenBucket rateLimit;
    @Getter
    private final Instant openedAt;
    private final AtomicInteger violations = new AtomicInteger();
    private volatile GuestSession player;

    public ClientConnection(WebSocketSession session, ObjectWriter writer, TokenBucket rateLimit, Instant openedAt) {
        this.session = session;
        this.writer = writer;
        this.rateLimit = rateLimit;
        this.openedAt = openedAt;
    }

    public String id() {
        return session.getId();
    }

    public void bind(GuestSession player) {
        this.player = player;
    }

    public GuestSession player() {
        return player;
    }

    public boolean isAuthenticated() {
        return player != null;
    }

    public boolean isOpen() {
        return session.isOpen();
    }

    /** Consumes one message from the rate limit budget. */
    public boolean allowMessage() {
        return rateLimit.tryConsume();
    }

    /** @return number of rejected messages so far */
    public int registerViolation() {
        return violations.incrementAndGet();
    }

    public void send(ServerMessage message) {
        if (!session.isOpen()) return;
        try {
            session.sendMessage(new TextMessage(writer.writeValueAsString(message)));
        } catch (JsonProcessingException e) {
            log.error("Cannot serialize {}", message.getClass().getSimpleName(), e);
        } catch (IOException | RuntimeException e) {
            // includes SessionLimitExceededException of the decorator (slow consumer)
            log.debug("Send to {} failed: {}", id(), e.getMessage());
            close(CloseStatus.SESSION_NOT_RELIABLE);
        }
    }

    public void closeReplaced() {
        close(REPLACED);
    }

    public void closeNormally() {
        close(CloseStatus.NORMAL);
    }

    public void close(CloseStatus status) {
        try {
            if (session.isOpen()) session.close(status);
        } catch (IOException e) {
            log.debug("Close of {} failed: {}", id(), e.getMessage());
        }
    }
}
