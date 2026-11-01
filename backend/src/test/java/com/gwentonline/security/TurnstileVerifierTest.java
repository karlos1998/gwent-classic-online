package com.gwentonline.security;

import com.gwentonline.config.GwentProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;

class TurnstileVerifierTest {
    static GwentProperties properties(boolean testMode, String siteKey, String secret, String origin) {
        return new GwentProperties(null, null, null, null,
                new GwentProperties.Cors(List.of(origin)), null,
                new GwentProperties.Turnstile(testMode, siteKey, secret, List.of("gwent.letscode.it")));
    }

    private final RestClient.Builder builder = RestClient.builder().baseUrl("https://challenges.cloudflare.com");
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final TurnstileVerifier verifier = new TurnstileVerifier(
            properties(false, "production-site", "production-secret", "https://gwent.letscode.it"), builder.build());

    private void response(String body) {
        server.expect(requestTo("https://challenges.cloudflare.com/turnstile/v0/siteverify"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string("secret=production-secret&response=token"))
                .andRespond(withSuccess(body, APPLICATION_JSON));
    }

    @Test void acceptsVerifiedHostnameAndAction() {
        response("{\"success\":true,\"hostname\":\"gwent.letscode.it\",\"action\":\"online-entry\"}");
        assertDoesNotThrow(() -> verifier.verify("token"));
        server.verify();
    }

    @Test void rejectsUnverifiedExpiredAndReplayedTokens() {
        response("{\"success\":false,\"error-codes\":[\"timeout-or-duplicate\"]}");
        assertFalse(assertThrows(TurnstileVerifier.ChallengeException.class, () -> verifier.verify("token")).unavailable());
    }

    @Test void rejectsDifferentHostname() {
        response("{\"success\":true,\"hostname\":\"evil.example\",\"action\":\"online-entry\"}");
        assertThrows(TurnstileVerifier.ChallengeException.class, () -> verifier.verify("token"));
    }

    @Test void rejectsDifferentAction() {
        response("{\"success\":true,\"hostname\":\"gwent.letscode.it\",\"action\":\"another-form\"}");
        assertThrows(TurnstileVerifier.ChallengeException.class, () -> verifier.verify("token"));
    }

    @Test void missingTokenDoesNotCallCloudflare() {
        assertThrows(TurnstileVerifier.ChallengeException.class, () -> verifier.verify(null));
        assertThrows(TurnstileVerifier.ChallengeException.class, () -> verifier.verify(" "));
        assertThrows(TurnstileVerifier.ChallengeException.class, () -> verifier.verify("x".repeat(2049)));
        server.verify();
    }

    @Test void cloudflareOutageFailsClosed() {
        server.expect(anything()).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertTrue(assertThrows(TurnstileVerifier.ChallengeException.class, () -> verifier.verify("token")).unavailable());
    }

    @Test void productionCannotStartWithTestKeys() {
        assertThrows(IllegalStateException.class, () -> new TurnstileVerifier(properties(false,
                "1x00000000000000000000AA", "1x0000000000000000000000000000000AA", "https://gwent.letscode.it"), builder.build()));
    }

    @Test void testModeCannotStartOnPublicOrigins() {
        assertThrows(IllegalStateException.class, () -> new TurnstileVerifier(properties(true,
                "1x00000000000000000000AA", "1x0000000000000000000000000000000AA", "https://gwent.letscode.it"), builder.build()));
    }

    @Test void localTestModeStillCallsSiteverify() {
        var local = new TurnstileVerifier(properties(true, "1x00000000000000000000AA",
                "1x0000000000000000000000000000000AA", "http://localhost:47320"), builder.build());
        server.expect(anything()).andRespond(withSuccess("{\"success\":true,\"hostname\":\"dummy-key-pass\"}", APPLICATION_JSON));
        local.verify("token");
        server.verify();
    }
}
