package com.gwentonline.config;

import com.gwentonline.player.api.GuestSessionController;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** CORS for the REST API (only needed when the web client is served from another origin). */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final GwentProperties properties;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(properties.cors().allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "DELETE")
                .allowedHeaders("Content-Type", GuestSessionController.TOKEN_HEADER)
                .maxAge(3600);
    }
}
