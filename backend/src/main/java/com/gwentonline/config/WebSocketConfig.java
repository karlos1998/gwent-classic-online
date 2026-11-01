package com.gwentonline.config;

import com.gwentonline.transport.GameWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/** Registers the game endpoint with an origin allow-list and container-level frame limits. */
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final GameWebSocketHandler handler;
    private final GwentProperties properties;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, properties.websocket().path())
                .setAllowedOrigins(properties.cors().allowedOrigins().toArray(String[]::new));
    }

    @Bean
    ServletServerContainerFactoryBean webSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(properties.websocket().maxMessageBytes());
        container.setMaxBinaryMessageBufferSize(1024);
        container.setMaxSessionIdleTimeout(properties.websocket().idleTimeout().toMillis());
        return container;
    }
}
