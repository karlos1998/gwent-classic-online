package com.gwentonline.protocol;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/**
 * Messages sent by the browser. Only the subtypes listed here can be deserialized (no default typing),
 * and every record validates its own fields, so malformed input fails before it reaches a service.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes({
        @JsonSubTypes.Type(value = ClientMessage.Auth.class, name = "auth"),
        @JsonSubTypes.Type(value = ClientMessage.Ping.class, name = "ping"),
        @JsonSubTypes.Type(value = ClientMessage.FindMatch.class, name = "findMatch"),
        @JsonSubTypes.Type(value = ClientMessage.CancelSearch.class, name = "cancelSearch"),
        @JsonSubTypes.Type(value = ClientMessage.RespondMatch.class, name = "respondMatch"),
        @JsonSubTypes.Type(value = ClientMessage.PlayCard.class, name = "playCard"),
        @JsonSubTypes.Type(value = ClientMessage.Pass.class, name = "pass"),
        @JsonSubTypes.Type(value = ClientMessage.ActivateLeader.class, name = "activateLeader"),
        @JsonSubTypes.Type(value = ClientMessage.ChooseCard.class, name = "chooseCard"),
        @JsonSubTypes.Type(value = ClientMessage.ChooseRow.class, name = "chooseRow"),
        @JsonSubTypes.Type(value = ClientMessage.ChooseStart.class, name = "chooseStart"),
        @JsonSubTypes.Type(value = ClientMessage.FinishMulligan.class, name = "finishMulligan"),
        @JsonSubTypes.Type(value = ClientMessage.Surrender.class, name = "surrender")
})
public sealed interface ClientMessage {

    int MAX_ID_LENGTH = 64;

    /** First message of every connection. The token comes from {@code POST /api/v1/sessions}. */
    record Auth(String token) implements ClientMessage {
        public Auth {
            requireText(token, "token", 128);
        }
    }

    record Ping() implements ClientMessage {
    }

    /** Lobby commands (only valid while not in a game). */
    sealed interface LobbyCommand extends ClientMessage {
    }

    record FindMatch(DeckDto deck) implements LobbyCommand {
        public FindMatch {
            if (deck == null) throw new IllegalArgumentException("deck");
        }
    }

    record CancelSearch() implements LobbyCommand {
    }

    record RespondMatch(String matchId, boolean accept) implements LobbyCommand {
        public RespondMatch {
            requireText(matchId, "matchId", MAX_ID_LENGTH);
        }
    }

    /** Commands for a running game. Turn commands answer the prompt with the given id. */
    sealed interface GameCommand extends ClientMessage {
    }

    sealed interface PromptAnswer extends GameCommand {
        String promptId();
    }

    /** @param slot ordinal name of {@code BoardSlot}, ignored for Scorch; {@code targetCardId} for Decoy */
    record PlayCard(String promptId, int cardId, String slot, Integer targetCardId) implements PromptAnswer {
        public PlayCard {
            requireText(promptId, "promptId", MAX_ID_LENGTH);
            if (slot != null && slot.length() > 32) throw new IllegalArgumentException("slot");
        }
    }

    record Pass(String promptId) implements PromptAnswer {
        public Pass {
            requireText(promptId, "promptId", MAX_ID_LENGTH);
        }
    }

    record ActivateLeader(String promptId) implements PromptAnswer {
        public ActivateLeader {
            requireText(promptId, "promptId", MAX_ID_LENGTH);
        }
    }

    /** {@code cardId == null} cancels a cancellable choice. */
    record ChooseCard(String promptId, Integer cardId) implements PromptAnswer {
        public ChooseCard {
            requireText(promptId, "promptId", MAX_ID_LENGTH);
        }
    }

    record ChooseRow(String promptId, String row) implements PromptAnswer {
        public ChooseRow {
            requireText(promptId, "promptId", MAX_ID_LENGTH);
            requireText(row, "row", 16);
        }
    }

    record ChooseStart(String promptId, boolean start) implements PromptAnswer {
        public ChooseStart {
            requireText(promptId, "promptId", MAX_ID_LENGTH);
        }
    }

    record FinishMulligan(String promptId) implements PromptAnswer {
        public FinishMulligan {
            requireText(promptId, "promptId", MAX_ID_LENGTH);
        }
    }

    /** Give up the running game (allowed at any time, also during the opponent's turn). */
    record Surrender() implements GameCommand {
    }

    private static void requireText(String value, String field, int maxLength) {
        if (value == null || value.isBlank() || value.length() > maxLength) {
            throw new IllegalArgumentException(field);
        }
    }
}
