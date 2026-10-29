package com.gwentonline.player.api;

import com.gwentonline.protocol.PlayerProfileDto;

/** @param token secret for the WebSocket {@code auth} message - keep it in the browser session only */
public record SessionResponse(String token, PlayerProfileDto profile, long idleTtlSeconds) {
}
