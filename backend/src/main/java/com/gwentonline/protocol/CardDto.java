package com.gwentonline.protocol;

/**
 * A visible card. {@code index} points into the shared card catalog, {@code id} is an opaque per-game id.
 */
public record CardDto(int id, int index, int power) {
}
