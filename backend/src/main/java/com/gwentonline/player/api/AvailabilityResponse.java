package com.gwentonline.player.api;

/** @param error validation error code if the nickname is not valid at all */
public record AvailabilityResponse(boolean available, String error) {
}
