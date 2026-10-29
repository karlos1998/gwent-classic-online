package com.gwentonline.transport;

import com.gwentonline.common.GwentException;
import com.gwentonline.config.GwentProperties;
import com.gwentonline.game.room.GameService;
import com.gwentonline.matchmaking.MatchmakingService;
import com.gwentonline.player.GuestSession;
import com.gwentonline.player.SessionRegistry;
import com.gwentonline.protocol.ClientMessage;
import com.gwentonline.protocol.ServerMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Clock;

/** Routes parsed client messages to the lobby and game services. */
@Slf4j
@Component
@RequiredArgsConstructor
public class MessageDispatcher {

    private final SessionRegistry sessions;
    private final MatchmakingService matchmaking;
    private final GameService games;
    private final GwentProperties properties;
    private final Clock clock;

    public void dispatch(ClientConnection connection, ClientMessage message) {
        try {
            switch (message) {
                case ClientMessage.Auth auth -> authenticate(connection, auth);
                case ClientMessage.Ping ignored -> connection.send(new ServerMessage.Pong(clock.millis()));
                case ClientMessage.LobbyCommand command -> lobby(requirePlayer(connection), command);
                case ClientMessage.GameCommand command -> games.submit(requirePlayer(connection), command);
            }
        } catch (GwentException e) {
            connection.send(new ServerMessage.ErrorMessage(e.code()));
        } catch (RuntimeException e) {
            log.error("Unexpected error handling {}", message.getClass().getSimpleName(), e);
            connection.send(new ServerMessage.ErrorMessage("server.error"));
        }
    }

    private void authenticate(ClientConnection connection, ClientMessage.Auth auth) {
        if (connection.isAuthenticated()) throw new GwentException("auth.already");
        GuestSession session = sessions.attach(auth.token(), connection).orElse(null);
        if (session == null) {
            connection.send(new ServerMessage.ErrorMessage("auth.invalid"));
            connection.close(ClientConnection.AUTH_FAILED);
            return;
        }
        connection.send(new ServerMessage.Welcome(session.profile(), ServerMessage.Status.valueOf(session.status().name()),
                clock.millis(), properties.game().turnTimeout().toMillis()));
        sessions.announceConnected(session);
    }

    private void lobby(GuestSession session, ClientMessage.LobbyCommand command) {
        switch (command) {
            case ClientMessage.FindMatch find -> matchmaking.search(session, find.deck());
            case ClientMessage.CancelSearch ignored -> matchmaking.cancel(session);
            case ClientMessage.RespondMatch respond -> matchmaking.respond(session, respond.matchId(), respond.accept());
        }
    }

    private static GuestSession requirePlayer(ClientConnection connection) {
        if (!connection.isAuthenticated()) throw new GwentException("auth.required");
        return connection.player();
    }
}
