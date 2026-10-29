package com.gwentonline.game.room;

import com.gwentonline.common.GwentException;
import com.gwentonline.common.SecureIds;
import com.gwentonline.config.GwentProperties;
import com.gwentonline.game.engine.DeckSpec;
import com.gwentonline.game.engine.card.CardCatalog;
import com.gwentonline.player.GuestSession;
import com.gwentonline.player.PlayerStatus;
import com.gwentonline.player.SessionEvents;
import com.gwentonline.protocol.ClientMessage;
import com.gwentonline.protocol.ServerMessage;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Creates game rooms for accepted matches and routes in-game commands to them. */
@Slf4j
@Service
public class GameService {

    /** A player entering a game with the deck they queued with. */
    public record Participant(GuestSession session, DeckSpec deck) {
    }

    private final Map<String, GameRoom> rooms = new ConcurrentHashMap<>();
    private final Map<GuestSession, GameRoom> roomsByPlayer = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final CardCatalog catalog;
    private final GwentProperties.Game settings;
    private final Clock clock;
    private final Counter gamesStarted;

    public GameService(CardCatalog catalog, GwentProperties properties, Clock clock, MeterRegistry meters) {
        this.catalog = catalog;
        this.settings = properties.game();
        this.clock = clock;
        this.gamesStarted = Counter.builder("gwent.games.started").description("Games started").register(meters);
        Gauge.builder("gwent.games.active", rooms, Map::size).description("Running games").register(meters);
    }

    /** Starts a game for two players that accepted their match. Seats (and so the coin toss) are random. */
    public void start(Participant a, Participant b) {
        if (rooms.size() >= settings.maxConcurrentGames()) {
            List.of(a, b).forEach(p -> {
                p.session().setStatus(PlayerStatus.IDLE);
                p.session().send(new ServerMessage.ErrorMessage("server.busy"));
            });
            log.warn("Game limit of {} reached, match rejected", settings.maxConcurrentGames());
            return;
        }
        List<Participant> seats = new ArrayList<>(List.of(a, b));
        if (random.nextBoolean()) seats = List.of(b, a);
        GameRoom room = new GameRoom(SecureIds.id(),
                seats.stream().map(Participant::session).toList(),
                seats.stream().map(Participant::deck).toList(),
                catalog,
                new GameRoom.Settings(settings.turnTimeout(), settings.reconnectGrace(), settings.pacingFactor()),
                clock,
                this::finished);
        rooms.put(room.id(), room);
        room.seats().forEach(s -> roomsByPlayer.put(s, room));
        gamesStarted.increment();
        log.info("Game {} started: {} vs {}", room.id(), room.seats().get(0), room.seats().get(1));
        room.start();
    }

    public void submit(GuestSession session, ClientMessage.GameCommand command) {
        GameRoom room = roomsByPlayer.get(session);
        if (room == null) throw new GwentException("game.notInGame");
        room.submit(session, command);
    }

    public int activeGames() {
        return rooms.size();
    }

    @EventListener
    public void onConnected(SessionEvents.Connected event) {
        GameRoom room = roomsByPlayer.get(event.session());
        if (room != null) room.connectionChanged(event.session(), true);
    }

    @EventListener
    public void onDisconnected(SessionEvents.Disconnected event) {
        GameRoom room = roomsByPlayer.get(event.session());
        if (room != null) room.connectionChanged(event.session(), false);
    }

    @PreDestroy
    public void shutdown() {
        rooms.values().forEach(GameRoom::shutdown);
    }

    private void finished(GameRoom room) {
        rooms.remove(room.id());
        room.seats().forEach(s -> {
            roomsByPlayer.remove(s, room);
            s.transition(PlayerStatus.IN_GAME, PlayerStatus.IDLE);
        });
    }
}
