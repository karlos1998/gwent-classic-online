package com.gwentonline.player.api;

import com.gwentonline.common.ClientRateLimiter;
import com.gwentonline.player.GuestSession;
import com.gwentonline.player.NicknamePolicy;
import com.gwentonline.player.SessionRegistry;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Guest sign-in: pick a unique nickname, get a session token for the WebSocket. */
@Validated
@RestController
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
@Tag(name = "Guest sessions", description = "Nickname based sessions without an account")
public class GuestSessionController {

    public static final String TOKEN_HEADER = "X-Session-Token";

    private final SessionRegistry sessions;
    private final ClientRateLimiter rateLimiter;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a guest session for a unique nickname")
    public SessionResponse create(@Valid @RequestBody CreateSessionRequest request, HttpServletRequest http) {
        rateLimiter.check(http.getRemoteAddr());
        GuestSession session = sessions.create(request.nickname());
        return new SessionResponse(session.token(), session.profile(), sessions.idleTtl().toSeconds());
    }

    @GetMapping("/availability")
    @Operation(summary = "Check whether a nickname is valid and free")
    public AvailabilityResponse availability(@RequestParam @Size(max = 64) String nickname) {
        return NicknamePolicy.check(nickname)
                .map(error -> new AvailabilityResponse(false, error))
                .orElseGet(() -> new AvailabilityResponse(sessions.isAvailable(nickname), null));
    }

    @DeleteMapping("/current")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "End the guest session and free the nickname")
    public void logout(@RequestHeader(TOKEN_HEADER) @Size(max = 128) String token) {
        sessions.release(token);
    }
}
