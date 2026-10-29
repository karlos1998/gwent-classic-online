package com.gwentonline.common;

import java.time.Clock;

/** Small thread-safe token bucket used for per-connection and per-IP rate limiting. */
public final class TokenBucket {

    private final double capacity;
    private final double refillPerMilli;
    private final Clock clock;
    private double tokens;
    private long lastRefill;

    public TokenBucket(double capacity, double refillPerSecond, Clock clock) {
        this.capacity = capacity;
        this.refillPerMilli = refillPerSecond / 1000.0;
        this.clock = clock;
        this.tokens = capacity;
        this.lastRefill = clock.millis();
    }

    /** @return true if a token was available and consumed */
    public synchronized boolean tryConsume() {
        long now = clock.millis();
        tokens = Math.min(capacity, tokens + (now - lastRefill) * refillPerMilli);
        lastRefill = now;
        if (tokens >= 1) {
            tokens -= 1;
            return true;
        }
        return false;
    }
}
