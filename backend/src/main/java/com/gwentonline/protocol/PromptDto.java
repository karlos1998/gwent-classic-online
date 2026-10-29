package com.gwentonline.protocol;

import java.util.List;

/**
 * A decision the server waits for. Answer with a {@link ClientMessage.GameCommand} carrying the same
 * {@code promptId}; stale ids are rejected.
 */
public record PromptDto(
        String promptId,
        Kind kind,
        long timeoutMs,
        long remainingMs,
        String choice,
        List<CardDto> options,
        CardDto card,
        boolean cancellable,
        int remaining) {

    public enum Kind { TURN, CHOOSE_CARD, CHOOSE_ROW, CHOOSE_START, MULLIGAN }
}
