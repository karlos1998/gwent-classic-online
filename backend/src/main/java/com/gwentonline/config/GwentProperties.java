package com.gwentonline.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.List;

/** Typed application settings ({@code gwent.*} in application.yml, overridable by environment variables). */
@Validated
@ConfigurationProperties(prefix = "gwent")
public record GwentProperties(
        @Valid @NotNull Session session,
        @Valid @NotNull Websocket websocket,
        @Valid @NotNull Matchmaking matchmaking,
        @Valid @NotNull Game game,
        @Valid @NotNull Cors cors,
        @Valid @NotNull RateLimit rateLimit,
        @Valid @NotNull Turnstile turnstile) {

    /**
     * @param maxSessions maximum number of guest sessions at the same time
     * @param idleTtl     how long a session without connection keeps its nickname
     */
    public record Session(@Positive int maxSessions, @NotNull Duration idleTtl) {
    }

    /**
     * @param maxMessageBytes     largest accepted client frame
     * @param authTimeout         time to send the auth message after connecting
     * @param sendTimeLimit       slow clients are disconnected after this send time
     * @param rateCapacity        token bucket size (burst) per connection
     * @param rateRefillPerSecond sustained messages per second per connection
     * @param maxRateViolations   connection is closed after this many rejected messages
     */
    public record Websocket(
            @NotBlank String path,
            @Positive int maxMessageBytes,
            @NotNull Duration authTimeout,
            @NotNull Duration sendTimeLimit,
            @Positive int sendBufferBytes,
            @NotNull Duration idleTimeout,
            @Positive int rateCapacity,
            @Positive double rateRefillPerSecond,
            @Positive int maxRateViolations,
            @Positive int maxConnections,
            @Positive int maxConnectionsPerIp) {
    }

    /**
     * @param confirmTimeout  time to accept a found match
     * @param declineCooldown two players who declined each other are not paired again during this time
     */
    public record Matchmaking(@NotNull Duration confirmTimeout, @NotNull Duration declineCooldown) {
    }

    /**
     * @param turnTimeout     time limit of every move / decision
     * @param reconnectGrace  a disconnected player loses after this time
     * @param pacingFactor    animation pacing multiplier (0 = no pauses, used by tests)
     */
    public record Game(
            @NotNull Duration turnTimeout,
            @NotNull Duration reconnectGrace,
            @PositiveOrZero double pacingFactor,
            @Positive int maxConcurrentGames) {
    }

    public record Cors(@NotEmpty List<String> allowedOrigins) {
    }

    /** Server-side challenge configuration; never expose the secret through diagnostics. */
    public record Turnstile(boolean testMode, @NotBlank String siteKey, @NotBlank String secretKey,
                            @NotEmpty List<String> hostnames) {
        @Override
        public String toString() { return "Turnstile[secretKey=REDACTED]"; }
    }

    /** @param sessionsPerMinute guest session creations per client IP and minute */
    public record RateLimit(@Positive int sessionsPerMinute) {
    }
}
