package com.gwentonline.transport;

import tools.jackson.core.JacksonException;
import com.gwentonline.common.TokenBucket;
import com.gwentonline.common.ClientRateLimiter;
import com.gwentonline.config.GwentProperties;
import com.gwentonline.player.SessionRegistry;
import com.gwentonline.protocol.ClientMessage;
import com.gwentonline.protocol.ServerMessage;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Raw WebSocket endpoint ({@code /ws}). Responsible only for transport concerns: message size, rate
 * limiting, JSON parsing and the authentication deadline. Business logic lives in {@link MessageDispatcher}.
 */
@Slf4j
@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final Map<String, ClientConnection> connections = new ConcurrentHashMap<>();
    private final Map<String, String> addresses = new java.util.HashMap<>();
    private final Map<String, Integer> perIp = new java.util.HashMap<>();
    private final ClientRateLimiter ipRateLimiter;
    private final ProtocolCodec codec;
    private final MessageDispatcher dispatcher;
    private final SessionRegistry sessions;
    private final GwentProperties.Websocket settings;
    private final Clock clock;

    public GameWebSocketHandler(ProtocolCodec codec, MessageDispatcher dispatcher,
                                SessionRegistry sessions, GwentProperties properties, Clock clock, MeterRegistry meters,
                                ClientRateLimiter ipRateLimiter) {
        this.ipRateLimiter = ipRateLimiter;
        this.codec = codec;
        this.dispatcher = dispatcher;
        this.sessions = sessions;
        this.settings = properties.websocket();
        this.clock = clock;
        Gauge.builder("gwent.connections.active", connections, Map::size).description("Open WebSocket connections").register(meters);
    }

    @Override
    public synchronized void afterConnectionEstablished(WebSocketSession session) throws java.io.IOException {
        String ip = session.getRemoteAddress() == null ? "unknown" : session.getRemoteAddress().getAddress().getHostAddress();
        if (connections.size() >= settings.maxConnections() || perIp.getOrDefault(ip, 0) >= settings.maxConnectionsPerIp()) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        addresses.put(session.getId(), ip);
        perIp.merge(ip, 1, Integer::sum);
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session,
                (int) settings.sendTimeLimit().toMillis(), settings.sendBufferBytes(),
                ConcurrentWebSocketSessionDecorator.OverflowStrategy.TERMINATE);
        TokenBucket bucket = new TokenBucket(settings.rateCapacity(), settings.rateRefillPerSecond(), clock);
        connections.put(session.getId(), new ClientConnection(safe, codec.writer(), bucket, clock.instant()));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        ClientConnection connection = connections.get(session.getId());
        if (connection == null) return;
        if (message.getPayloadLength() > settings.maxMessageBytes()) {
            connection.close(CloseStatus.TOO_BIG_TO_PROCESS);
            return;
        }
        if (!connection.allowMessage()) {
            if (connection.registerViolation() > settings.maxRateViolations()) {
                log.warn("Closing {} - rate limit exceeded repeatedly", connection.id());
                connection.close(ClientConnection.RATE_LIMITED);
            } else {
                connection.send(new ServerMessage.ErrorMessage("rateLimited"));
            }
            return;
        }
        try {
            ipRateLimiter.check("ws-message:" + clientIp(session), 2400);
        } catch (ClientRateLimiter.TooManyRequestsException e) {
            connection.close(ClientConnection.RATE_LIMITED);
            return;
        }
        ClientMessage parsed;
        try {
            parsed = codec.read(message.getPayload());
        } catch (JacksonException e) {
            if (connection.registerViolation() >= settings.maxRateViolations()) {
                connection.close(CloseStatus.BAD_DATA);
                return;
            }
            connection.send(new ServerMessage.ErrorMessage("protocol.invalidMessage"));
            return;
        }
        dispatcher.dispatch(connection, parsed);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("Transport error on {}: {}", session.getId(), exception.getMessage());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        releaseAddress(session.getId());
        ClientConnection connection = connections.remove(session.getId());
        if (connection != null && connection.isAuthenticated()) {
            sessions.detach(connection.player(), connection);
        }
    }

    private synchronized String clientIp(WebSocketSession session) {
        return addresses.getOrDefault(session.getId(), "unknown");
    }

    private synchronized void releaseAddress(String id) {
        String ip = addresses.remove(id);
        if (ip != null) perIp.computeIfPresent(ip, (key, count) -> count <= 1 ? null : count - 1);
    }

    /** Connections must authenticate shortly after opening; idle anonymous sockets are dropped. */
    @Scheduled(fixedDelayString = "PT2S")
    public void closeUnauthenticated() {
        Instant threshold = clock.instant().minus(settings.authTimeout());
        connections.values().stream()
                .filter(c -> !c.isAuthenticated() && c.getOpenedAt().isBefore(threshold))
                .forEach(c -> c.close(ClientConnection.AUTH_TIMEOUT));
    }
}
