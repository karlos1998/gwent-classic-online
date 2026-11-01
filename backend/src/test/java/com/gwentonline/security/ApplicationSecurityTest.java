package com.gwentonline.security;

import com.gwentonline.config.GwentProperties;
import com.gwentonline.game.engine.card.CardCatalog;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class ApplicationSecurityTest {
    @Autowired MockMvc mvc;
    @Autowired CardCatalog cards;
    @Autowired GwentProperties properties;

    @Test void startsWithLocalTestConfigurationAndCardCatalog() throws Exception {
        assertTrue(properties.turnstile().testMode());
        assertEquals(216, cards.all().size());
        mvc.perform(get("/api/v1/sessions/challenge"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.siteKey").value("1x00000000000000000000AA"))
                .andExpect(jsonPath("$.secretKey").doesNotExist());
    }

    @Test void diagnosticsAreDisabled() throws Exception {
        mvc.perform(get("/actuator/metrics")).andExpect(status().isNotFound());
        mvc.perform(get("/api/docs")).andExpect(status().isNotFound());
    }
}
