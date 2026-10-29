package com.gwentonline.config;

import com.gwentonline.game.engine.DeckValidator;
import com.gwentonline.game.engine.card.CardCatalog;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/** Wires the framework-free game engine into Spring. */
@Configuration(proxyBeanMethods = false)
public class EngineConfig {

    @Bean
    CardCatalog cardCatalog() {
        return CardCatalog.loadDefault();
    }

    @Bean
    DeckValidator deckValidator(CardCatalog catalog) {
        return new DeckValidator(catalog);
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
