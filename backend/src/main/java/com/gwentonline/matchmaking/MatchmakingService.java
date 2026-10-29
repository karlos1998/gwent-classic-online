package com.gwentonline.matchmaking;

import com.gwentonline.common.GwentException;
import com.gwentonline.common.SecureIds;
import com.gwentonline.config.GwentProperties;
import com.gwentonline.game.engine.DeckSpec;
import com.gwentonline.game.engine.DeckValidator;
import com.gwentonline.game.room.GameService;
import com.gwentonline.player.GuestSession;
import com.gwentonline.player.PlayerStatus;
import com.gwentonline.player.SessionEvents;
import com.gwentonline.protocol.DeckDto;
import com.gwentonline.protocol.ServerMessage;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Function;

/**
 * Quick-match queue. Two waiting players are paired first-come-first-served, both must accept the match
 * within {@code gwent.matchmaking.confirm-timeout}. If one declines, both go back to searching and are not
 * paired with each other again for {@code decline-cooldown}.
 *
 * <p>All state is guarded by one lock; messages are sent after the lock is released.</p>
 */
@Slf4j
@Service
public class MatchmakingService {

    private final ReentrantLock lock = new ReentrantLock();
    private final LinkedHashMap<GuestSession, SearchTicket> queue = new LinkedHashMap<>();
    private final Map<String, PendingMatch> pending = new HashMap<>();
    private final Map<GuestSession, PendingMatch> pendingBySession = new HashMap<>();
    private final Map<PlayerPair, Instant> cooldowns = new HashMap<>();

    private final DeckValidator deckValidator;
    private final GameService games;
    private final GwentProperties.Matchmaking settings;
    private final Clock clock;

    public MatchmakingService(DeckValidator deckValidator, GameService games, GwentProperties properties,
                              Clock clock, MeterRegistry meters) {
        this.deckValidator = deckValidator;
        this.games = games;
        this.settings = properties.matchmaking();
        this.clock = clock;
        Gauge.builder("gwent.matchmaking.queue", this, MatchmakingService::queueSize).description("Players searching").register(meters);
    }

    /** Starts searching with the given deck (validated server-side). */
    public void search(GuestSession session, DeckDto deckDto) {
        DeckSpec deck = toSpec(deckDto);
        List<String> errors = deckValidator.validate(deck);
        if (!errors.isEmpty()) throw new GwentException(errors.getFirst());
        Outbox outbox = new Outbox();
        lock.lock();
        try {
            if (!session.transition(PlayerStatus.IDLE, PlayerStatus.SEARCHING)) throw new GwentException("lobby.busy");
            Instant now = clock.instant();
            queue.put(session, new SearchTicket(session, deck, now));
            outbox.add(session, new ServerMessage.Searching(now.toEpochMilli()));
            pairWaitingPlayers(outbox);
        } finally {
            lock.unlock();
        }
        outbox.flush();
    }

    public void cancel(GuestSession session) {
        Outbox outbox = new Outbox();
        lock.lock();
        try {
            if (queue.remove(session) != null && session.transition(PlayerStatus.SEARCHING, PlayerStatus.IDLE)) {
                outbox.add(session, new ServerMessage.SearchCancelled());
            }
        } finally {
            lock.unlock();
        }
        outbox.flush();
    }

    public void respond(GuestSession session, String matchId, boolean accept) {
        Outbox outbox = new Outbox();
        Runnable startGame = null;
        lock.lock();
        try {
            PendingMatch match = pending.get(matchId);
            if (match == null || !match.involves(session)) throw new GwentException("match.notFound");
            if (!accept) {
                cancelMatch(match, outbox, side -> {
                    String reason = side.session() == session ? "declinedByYou" : "declinedByOpponent";
                    return new Outcome(true, reason);
                });
                cooldowns.put(PlayerPair.of(match.first().session(), match.second().session()),
                        clock.instant().plus(settings.declineCooldown()));
                pairWaitingPlayers(outbox);
            } else {
                match.accept(session);
                for (SearchTicket side : match.sides()) {
                    outbox.add(side.session(), new ServerMessage.MatchUpdate(match.id(),
                            match.hasAccepted(side.session()), match.hasAccepted(match.opponentOf(side.session()))));
                }
                if (match.bothAccepted()) {
                    removePending(match);
                    match.sides().forEach(side -> side.session().setStatus(PlayerStatus.IN_GAME));
                    startGame = () -> games.start(
                            new GameService.Participant(match.first().session(), match.first().deck()),
                            new GameService.Participant(match.second().session(), match.second().deck()));
                }
            }
        } finally {
            lock.unlock();
        }
        outbox.flush();
        if (startGame != null) startGame.run();
    }

    /** Expires unanswered matches and retries pairing (cooldowns may have ended). */
    @Scheduled(fixedDelayString = "PT1S")
    public void tick() {
        Outbox outbox = new Outbox();
        lock.lock();
        try {
            Instant now = clock.instant();
            cooldowns.values().removeIf(until -> until.isBefore(now));
            for (PendingMatch match : List.copyOf(pending.values())) {
                if (match.expiresAt().isBefore(now)) {
                    // whoever accepted keeps searching, players who did not answer are considered away
                    cancelMatch(match, outbox, side -> new Outcome(match.hasAccepted(side.session()), "timeout"));
                }
            }
            pairWaitingPlayers(outbox);
        } finally {
            lock.unlock();
        }
        outbox.flush();
    }

    @EventListener
    public void onDisconnected(SessionEvents.Disconnected event) {
        leave(event.session());
    }

    @EventListener
    public void onEnded(SessionEvents.Ended event) {
        leave(event.session());
    }

    public int queueSize() {
        lock.lock();
        try {
            return queue.size();
        } finally {
            lock.unlock();
        }
    }

    private void leave(GuestSession session) {
        Outbox outbox = new Outbox();
        lock.lock();
        try {
            if (queue.remove(session) != null) session.transition(PlayerStatus.SEARCHING, PlayerStatus.IDLE);
            PendingMatch match = pendingBySession.get(session);
            if (match != null) {
                cancelMatch(match, outbox, side -> side.session() == session
                        ? new Outcome(false, "left")
                        : new Outcome(true, "opponentLeft"));
                pairWaitingPlayers(outbox);
            }
        } finally {
            lock.unlock();
        }
        outbox.flush();
    }

    // ------------------------------------------------------------------ internals (lock held)

    private void pairWaitingPlayers(Outbox outbox) {
        List<SearchTicket> waiting = new ArrayList<>(queue.values());
        Instant now = clock.instant();
        for (int i = 0; i < waiting.size(); i++) {
            SearchTicket a = waiting.get(i);
            if (!queue.containsKey(a.session())) continue;
            for (int j = i + 1; j < waiting.size(); j++) {
                SearchTicket b = waiting.get(j);
                if (!queue.containsKey(b.session()) || cooldowns.containsKey(PlayerPair.of(a.session(), b.session()))) continue;
                createMatch(a, b, now, outbox);
                break;
            }
        }
    }

    private void createMatch(SearchTicket a, SearchTicket b, Instant now, Outbox outbox) {
        queue.remove(a.session());
        queue.remove(b.session());
        PendingMatch match = new PendingMatch(SecureIds.id(), a, b, now.plus(settings.confirmTimeout()));
        pending.put(match.id(), match);
        pendingBySession.put(a.session(), match);
        pendingBySession.put(b.session(), match);
        long timeout = settings.confirmTimeout().toMillis();
        for (SearchTicket side : match.sides()) {
            side.session().transition(PlayerStatus.SEARCHING, PlayerStatus.MATCH_FOUND);
            outbox.add(side.session(), new ServerMessage.MatchFound(match.id(), match.opponentOf(side.session()).profile(), timeout));
        }
        log.info("Match {} proposed: {} vs {}", match.id(), a.session(), b.session());
    }

    private void cancelMatch(PendingMatch match, Outbox outbox, Function<SearchTicket, Outcome> outcomeOf) {
        removePending(match);
        for (SearchTicket side : match.sides()) {
            Outcome outcome = outcomeOf.apply(side);
            GuestSession session = side.session();
            boolean requeue = outcome.searchAgain() && session.isConnected();
            if (requeue) {
                session.setStatus(PlayerStatus.SEARCHING);
                queue.put(session, side);
            } else {
                session.setStatus(PlayerStatus.IDLE);
            }
            outbox.add(session, new ServerMessage.MatchCancelled(match.id(), outcome.reason(), requeue));
            if (requeue) outbox.add(session, new ServerMessage.Searching(side.since().toEpochMilli()));
        }
    }

    private void removePending(PendingMatch match) {
        pending.remove(match.id());
        match.sides().forEach(side -> pendingBySession.remove(side.session(), match));
    }

    private static DeckSpec toSpec(DeckDto dto) {
        return new DeckSpec(dto.faction(), dto.leader(),
                dto.cards().stream().map(e -> new DeckSpec.Entry(e.index(), e.count())).toList());
    }

    private record Outcome(boolean searchAgain, String reason) {
    }

    /** Messages collected under the lock and sent afterwards. */
    private static final class Outbox {
        private final List<Runnable> messages = new ArrayList<>();

        void add(GuestSession session, ServerMessage message) {
            messages.add(() -> session.send(message));
        }

        void flush() {
            messages.forEach(Runnable::run);
        }
    }
}
