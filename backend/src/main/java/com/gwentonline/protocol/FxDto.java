package com.gwentonline.protocol;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import java.util.List;

/** Visual effects already translated for the recipient (relative keys like "me-turn" / "op-turn"). */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "kind")
@JsonSubTypes({
        @JsonSubTypes.Type(value = FxDto.Notification.class, name = "notification"),
        @JsonSubTypes.Type(value = FxDto.Animation.class, name = "animation"),
        @JsonSubTypes.Type(value = FxDto.Preview.class, name = "preview"),
        @JsonSubTypes.Type(value = FxDto.Sound.class, name = "sound"),
        @JsonSubTypes.Type(value = FxDto.Reveal.class, name = "reveal")
})
public sealed interface FxDto {

    /** @param key notification name as used by the client, e.g. {@code me-turn}, {@code win-round} */
    record Notification(String key) implements FxDto {
    }

    record Animation(int cardId, String animation) implements FxDto {
    }

    record Preview(CardDto card, long durationMs) implements FxDto {
    }

    record Sound(String key) implements FxDto {
    }

    record Reveal(List<CardDto> cards, String titleKey) implements FxDto {
    }
}
