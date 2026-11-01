package com.gwentonline.transport;

import com.gwentonline.common.ClientRateLimiter;
import com.gwentonline.config.GwentProperties;
import com.gwentonline.player.SessionRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.InetSocketAddress;
import java.time.Clock;
import java.time.Duration;

import static org.mockito.Mockito.*;

class WebSocketLimitsTest {
    private final GwentProperties properties = new GwentProperties(null,
            new GwentProperties.Websocket("/ws", 16384, Duration.ofSeconds(10), Duration.ofSeconds(5),
                    524288, Duration.ofSeconds(75), 30, 10, 3, 2, 1),
            null, null, null, new GwentProperties.RateLimit(10), null);
    private final MessageDispatcher dispatcher = mock(MessageDispatcher.class);
    private final GameWebSocketHandler handler = new GameWebSocketHandler(new ProtocolCodec(), dispatcher,
            mock(SessionRegistry.class), properties, Clock.systemUTC(), new SimpleMeterRegistry(),
            new ClientRateLimiter(properties, Clock.systemUTC()));

    private WebSocketSession socket(String id, String ip) {
        var socket = mock(WebSocketSession.class);
        when(socket.getId()).thenReturn(id);
        when(socket.getRemoteAddress()).thenReturn(new InetSocketAddress(ip, 1234));
        when(socket.isOpen()).thenReturn(true);
        return socket;
    }

    @Test void capsAnonymousSocketsPerIpAndReleasesSlotsOnClose() throws Exception {
        var first = socket("a", "127.0.0.1");
        var second = socket("b", "127.0.0.1");
        var third = socket("c", "127.0.0.1");
        handler.afterConnectionEstablished(first);
        handler.afterConnectionEstablished(second);
        verify(second).close(CloseStatus.POLICY_VIOLATION);
        handler.afterConnectionClosed(first, CloseStatus.NORMAL);
        handler.afterConnectionEstablished(third);
        verify(third, never()).close(any());
    }

    @Test void capsGlobalAnonymousSockets() throws Exception {
        handler.afterConnectionEstablished(socket("a", "127.0.0.1"));
        handler.afterConnectionEstablished(socket("b", "127.0.0.2"));
        var third = socket("c", "127.0.0.3");
        handler.afterConnectionEstablished(third);
        verify(third).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test void repeatedMalformedMessagesCloseConnectionBeforeDispatch() throws Exception {
        var socket = socket("a", "127.0.0.1");
        handler.afterConnectionEstablished(socket);
        for (int i = 0; i < 3; i++) handler.handleTextMessage(socket, new TextMessage("null"));
        verify(socket).close(CloseStatus.BAD_DATA);
        verifyNoInteractions(dispatcher);
    }
}
