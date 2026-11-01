package com.gwentonline.security;

import com.gwentonline.common.GwentException;
import com.gwentonline.config.GwentProperties;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.http.MediaType;

import java.net.URI;
import java.util.concurrent.Semaphore;

/** Tokens are verified by Cloudflare, once, before any guest session is created. */
@Service
public class TurnstileVerifier {
    private final GwentProperties.Turnstile settings;
    private final RestClient client;
    private final Semaphore pending = new Semaphore(16);

    public TurnstileVerifier(GwentProperties properties, RestClient turnstileClient) {
        settings = properties.turnstile();
        client = turnstileClient;
        if (settings.testMode()) {
            boolean local = properties.cors().allowedOrigins().stream().allMatch(origin -> {
                String host = URI.create(origin).getHost();
                return "localhost".equals(host) || "127.0.0.1".equals(host) || "[::1]".equals(host);
            });
            if (!local) throw new IllegalStateException("Turnstile test mode requires localhost origins");
            if (!settings.siteKey().equals("1x00000000000000000000AA")
                    || !settings.secretKey().equals("1x0000000000000000000000000000000AA")) {
                throw new IllegalStateException("Turnstile test mode requires the official always-pass test keys");
            }
        } else if (isTestKey(settings.siteKey()) || isTestKey(settings.secretKey())) {
            throw new IllegalStateException("Turnstile production requires real keys");
        }
    }

    private static boolean isTestKey(String key) {
        return key.matches("[123]x0+.*");
    }

    public String siteKey() { return settings.siteKey(); }

    public void verify(String token) {
        if (token == null || token.isBlank() || token.length() > 2048) throw new ChallengeException(false);
        if (!pending.tryAcquire()) throw new ChallengeException(true);
        try {
            var body = new LinkedMultiValueMap<String, String>();
            body.add("secret", settings.secretKey());
            body.add("response", token);
            Verification result = client.post().uri("/turnstile/v0/siteverify")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(body)
                    .retrieve().body(Verification.class);
            if (result == null || !result.success()
                    || (!settings.testMode() && (!settings.hostnames().contains(result.hostname())
                    || !"online-entry".equals(result.action())))) {
                throw new ChallengeException(false);
            }
        } catch (RestClientException e) {
            // Fail closed. Do not log response bodies, tokens or the secret.
            throw new ChallengeException(true);
        } finally {
            pending.release();
        }
    }

    public record Verification(boolean success, String hostname, String action) { }

    public static final class ChallengeException extends GwentException {
        private final boolean unavailable;
        public ChallengeException(boolean unavailable) {
            super(unavailable ? "captcha.unavailable" : "captcha.failed");
            this.unavailable = unavailable;
        }
        public boolean unavailable() { return unavailable; }
    }
}
