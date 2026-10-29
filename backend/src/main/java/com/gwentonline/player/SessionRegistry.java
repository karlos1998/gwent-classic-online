package com.gwentonline.player;

import com.gwentonline.common.SecureIds;
import com.gwentonline.config.GwentProperties;
import com.gwentonline.transport.ClientConnection;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory guest sessions. Nicknames are unique (case-insensitive) among all live sessions.
 * Thread-safe: all maps are concurrent and nickname reservation is atomic.
 */
@Slf4j
@Service
public class SessionRegistry {

    private final Map<String, GuestSession> byToken = new ConcurrentHashMap<>();
    private final Map<String, GuestSession> byNickname = new ConcurrentHashMap<>();
    private final GwentProperties.Session settings;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public SessionRegistry(GwentProperties properties, ApplicationEventPublisher events, Clock clock, MeterRegistry meters) {
        this.settings = properties.session();
        this.events = events;
        this.clock = clock;
        Gauge.builder("gwent.sessions.active", byToken, Map::size).description("Guest sessions").register(meters);
    }

    /** Registers a guest; throws {@link NicknameTakenException}, {@link InvalidNicknameException}, {@link ServerFullException}. */
    public GuestSession create(String rawNickname) {
        NicknamePolicy.check(rawNickname).ifPresent(code -> {
            throw new InvalidNicknameException(code);
        });
        if (byToken.size() >= settings.maxSessions()) throw new ServerFullException();
        String nickname = NicknamePolicy.normalize(rawNickname);
        GuestSession session = new GuestSession(SecureIds.id(), SecureIds.token(), nickname, clock.instant());
        if (byNickname.putIfAbsent(NicknamePolicy.key(nickname), session) != null) throw new NicknameTakenException();
        byToken.put(session.token(), session);
        log.info("Guest session created for {}", session);
        return session;
    }

    public boolean isAvailable(String rawNickname) {
        return NicknamePolicy.check(rawNickname).isEmpty() && !byNickname.containsKey(NicknamePolicy.key(rawNickname));
    }

    public Optional<GuestSession> findByToken(String token) {
        return token == null ? Optional.empty() : Optional.ofNullable(byToken.get(token));
    }

    /** Binds a connection to the session; an older connection of the same player (other tab) is closed. */
    public Optional<GuestSession> attach(String token, ClientConnection connection) {
        return findByToken(token).map(session -> {
            ClientConnection previous = session.getConnection();
            session.attach(connection, clock.instant());
            connection.bind(session);
            if (previous != null && previous != connection) previous.closeReplaced();
            return session;
        });
    }

    /** Lets matchmaking / games resend their state once the client got its welcome message. */
    public void announceConnected(GuestSession session) {
        events.publishEvent(new SessionEvents.Connected(session));
    }

    public void detach(GuestSession session, ClientConnection connection) {
        if (session.detach(connection, clock.instant())) {
            events.publishEvent(new SessionEvents.Disconnected(session));
        }
    }

    /** Explicit logout: ends the session immediately. */
    public void release(String token) {
        findByToken(token).ifPresent(this::end);
    }

    /** Frees nicknames of sessions that were disconnected for longer than the idle TTL and are not in a game. */
    @Scheduled(fixedDelayString = "PT10S")
    public void expireIdleSessions() {
        Instant threshold = clock.instant().minus(settings.idleTtl());
        byToken.values().stream()
                .filter(s -> !s.isConnected() && s.getLastSeen().isBefore(threshold) && s.status() != PlayerStatus.IN_GAME)
                .toList()
                .forEach(this::end);
    }

    public int size() {
        return byToken.size();
    }

    public Duration idleTtl() {
        return settings.idleTtl();
    }

    private void end(GuestSession session) {
        if (byToken.remove(session.token(), session)) {
            byNickname.remove(NicknamePolicy.key(session.getNickname()), session);
            ClientConnection connection = session.getConnection();
            if (connection != null) connection.closeNormally();
            events.publishEvent(new SessionEvents.Ended(session));
            log.info("Guest session ended for {}", session);
        }
    }
}
