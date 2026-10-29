package com.gwentonline.common;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.gwentonline.config.GwentProperties;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;

/** Per client IP rate limit for expensive REST calls (guest session creation). */
@Component
public class ClientRateLimiter {

    private final Cache<String, TokenBucket> buckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10))
            .maximumSize(100_000)
            .build();
    private final int perMinute;
    private final Clock clock;

    public ClientRateLimiter(GwentProperties properties, Clock clock) {
        this.perMinute = properties.rateLimit().sessionsPerMinute();
        this.clock = clock;
    }

    /** @throws TooManyRequestsException if the client exceeded its budget */
    public void check(String clientKey) {
        TokenBucket bucket = buckets.get(clientKey, key -> new TokenBucket(perMinute, perMinute / 60.0, clock));
        if (!bucket.tryConsume()) throw new TooManyRequestsException();
    }

    public static final class TooManyRequestsException extends GwentException {
        public TooManyRequestsException() {
            super("rateLimited");
        }
    }
}
