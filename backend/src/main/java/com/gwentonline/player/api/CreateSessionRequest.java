package com.gwentonline.player.api;

import com.gwentonline.player.ValidNickname;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;

/** Body of {@code POST /api/v1/sessions}. */
public record CreateSessionRequest(
        @Schema(description = "Unique nickname, 3-20 letters/digits with single inner spaces or _ - .", example = "Geralt")
        @ValidNickname String nickname,
        @NotBlank(message = "captcha.required") @Size(max = 2048) String turnstileToken) {
}
