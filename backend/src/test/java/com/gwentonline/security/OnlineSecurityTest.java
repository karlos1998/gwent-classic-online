package com.gwentonline.security;

import com.gwentonline.common.ClientRateLimiter;
import com.gwentonline.common.ApiExceptionHandler;
import com.gwentonline.config.GwentProperties;
import com.gwentonline.player.SessionRegistry;
import com.gwentonline.player.api.GuestSessionController;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;

class OnlineSecurityTest {
    private final GwentProperties properties = new GwentProperties(
            new GwentProperties.Session(2, Duration.ofMinutes(3)), null, null, null, null,
            new GwentProperties.RateLimit(10), null);
    private final SessionRegistry sessions = new SessionRegistry(properties, event -> {}, Clock.systemUTC(), new SimpleMeterRegistry());
    private final TurnstileVerifier verifier = mock(TurnstileVerifier.class);
    private MockMvc mvc;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new GuestSessionController(verifier, sessions))
                .setControllerAdvice(new ApiExceptionHandler())
                .addFilters(new RequestGuard(new ClientRateLimiter(properties, Clock.systemUTC())))
                .build();
    }

    @Test void concurrentCreationsCannotExceedGlobalSessionLimit() throws Exception {
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var start = new java.util.concurrent.CountDownLatch(1);
            var results = new java.util.ArrayList<java.util.concurrent.Future<Boolean>>();
            for (int i = 0; i < 20; i++) {
                final String nickname = "Player" + i;
                results.add(executor.submit(() -> {
                    start.await();
                    try { sessions.create(nickname); return true; }
                    catch (com.gwentonline.player.ServerFullException e) { return false; }
                }));
            }
            start.countDown();
            int accepted = 0;
            for (var result : results) if (result.get(5, java.util.concurrent.TimeUnit.SECONDS)) accepted++;
            assertEquals(2, accepted);
            assertEquals(2, sessions.size());
        }
    }

    @Test void missingChallengeNeverCreatesSession() throws Exception {
        mvc.perform(post("/api/v1/sessions").contentType(APPLICATION_JSON).content("{\"nickname\":\"Geralt\"}"))
                .andExpect(status().isBadRequest());
        assertEquals(0, sessions.size());
        verifyNoInteractions(verifier);
    }

    @Test void rejectedChallengeNeverReservesNickname() throws Exception {
        doThrow(new TurnstileVerifier.ChallengeException(false)).when(verifier).verify("bad");
        mvc.perform(post("/api/v1/sessions").contentType(APPLICATION_JSON)
                .content("{\"nickname\":\"Geralt\",\"turnstileToken\":\"bad\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("captcha.failed"));
        assertTrue(sessions.isAvailable("Geralt"));
        assertEquals(0, sessions.size());
    }

    @Test void verifiedSessionIsNotCacheable() throws Exception {
        mvc.perform(post("/api/v1/sessions").contentType(APPLICATION_JSON)
                .content("{\"nickname\":\"Geralt\",\"turnstileToken\":\"ok\"}"))
                .andExpect(status().isCreated()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.token").isString());
        verify(verifier).verify("ok");
        assertEquals(1, sessions.size());
    }

    @Test void malformedAttemptsAreLimitedBeforeValidation() throws Exception {
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/v1/sessions").contentType(APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/sessions").contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
        verifyNoInteractions(verifier);
    }

    @Test void oversizedBodyIsRejectedBeforeParsingEvenWithoutContentLength() throws Exception {
        mvc.perform(post("/api/v1/sessions").contentType(APPLICATION_JSON).content("x".repeat(16385)))
                .andExpect(status().is(413));
        verifyNoInteractions(verifier);
        assertEquals(0, sessions.size());
    }

    @Test void websocketUpgradeFloodIsLimited() throws Exception {
        for (int i = 0; i < 30; i++) mvc.perform(get("/ws")).andExpect(status().isNotFound());
        mvc.perform(get("/ws")).andExpect(status().isTooManyRequests());
    }
}
