package com.gwentonline.player.api;

import com.gwentonline.player.ValidNickname;
import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code POST /api/v1/sessions}. */
public record CreateSessionRequest(
        @Schema(description = "Unique nickname, 3-20 letters/digits with single inner spaces or _ - .", example = "Geralt")
        @ValidNickname String nickname) {
}
