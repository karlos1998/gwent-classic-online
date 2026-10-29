package com.gwentonline.protocol;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import java.util.List;

/** Messages sent to the browser. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = ServerMessage.Welcome.class, name = "welcome"),
        @JsonSubTypes.Type(value = ServerMessage.ErrorMessage.class, name = "error"),
        @JsonSubTypes.Type(value = ServerMessage.Pong.class, name = "pong"),
        @JsonSubTypes.Type(value = ServerMessage.Searching.class, name = "searching"),
        @JsonSubTypes.Type(value = ServerMessage.SearchCancelled.class, name = "searchCancelled"),
        @JsonSubTypes.Type(value = ServerMessage.MatchFound.class, name = "matchFound"),
        @JsonSubTypes.Type(value = ServerMessage.MatchUpdate.class, name = "matchUpdate"),
        @JsonSubTypes.Type(value = ServerMessage.MatchCancelled.class, name = "matchCancelled"),
        @JsonSubTypes.Type(value = ServerMessage.GameStarted.class, name = "gameStarted"),
        @JsonSubTypes.Type(value = ServerMessage.State.class, name = "state"),
        @JsonSubTypes.Type(value = ServerMessage.Fx.class, name = "fx"),
        @JsonSubTypes.Type(value = ServerMessage.Prompt.class, name = "prompt"),
        @JsonSubTypes.Type(value = ServerMessage.PromptClosed.class, name = "promptClosed"),
        @JsonSubTypes.Type(value = ServerMessage.Timer.class, name = "timer"),
        @JsonSubTypes.Type(value = ServerMessage.OpponentConnection.class, name = "opponentConnection"),
        @JsonSubTypes.Type(value = ServerMessage.GameOver.class, name = "gameOver")
})
public sealed interface ServerMessage {

    /** Lobby state of the player after authentication / reconnection. */
    enum Status { IDLE, SEARCHING, MATCH_FOUND, IN_GAME }

    record Welcome(PlayerProfileDto profile, Status status, long serverTime, long turnTimeoutMs) implements ServerMessage {
    }

    /** @param code stable error code, translated by the client ({@code errors.<code>}) */
    record ErrorMessage(String code) implements ServerMessage {
    }

    record Pong(long serverTime) implements ServerMessage {
    }

    record Searching(long sinceServerTime) implements ServerMessage {
    }

    record SearchCancelled() implements ServerMessage {
    }

    record MatchFound(String matchId, PlayerProfileDto opponent, long timeoutMs) implements ServerMessage {
    }

    record MatchUpdate(String matchId, boolean youAccepted, boolean opponentAccepted) implements ServerMessage {
    }

    /** @param reason {@code declinedByYou}, {@code declinedByOpponent}, {@code timeout}, {@code opponentLeft} */
    record MatchCancelled(String matchId, String reason, boolean searchingAgain) implements ServerMessage {
    }

    record GameStarted(String gameId, PlayerProfileDto self, PlayerProfileDto opponent, long turnTimeoutMs) implements ServerMessage {
    }

    record State(GameSnapshotDto snapshot) implements ServerMessage {
    }

    record Fx(FxDto effect) implements ServerMessage {
    }

    record Prompt(PromptDto prompt) implements ServerMessage {
    }

    record PromptClosed(String promptId) implements ServerMessage {
    }

    /** Turn timer for both players. {@code owner == null} hides the timer. */
    record Timer(GameSnapshotDto.Side owner, long timeoutMs, long remainingMs) implements ServerMessage {
    }

    record OpponentConnection(boolean connected, long graceMs) implements ServerMessage {
    }

    /**
     * @param result {@code win}, {@code lose} or {@code draw} from the recipient's point of view
     * @param reason {@code null}, {@code surrender} or {@code disconnect}
     */
    record GameOver(String result, String reason, List<RoundDto> rounds) implements ServerMessage {
    }

    record RoundDto(int self, int opponent, GameSnapshotDto.Side winner) {
    }
}
