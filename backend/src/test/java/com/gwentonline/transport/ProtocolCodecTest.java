package com.gwentonline.transport;

import tools.jackson.core.JacksonException;
import com.gwentonline.protocol.ClientMessage;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ProtocolCodecTest {
    private final ProtocolCodec codec = new ProtocolCodec();
    @Test void rejectsNullUnknownTypesAndMalformedFields() {
        for (String json : new String[]{"null", "{}", "{\"type\":\"java.lang.Runtime\"}",
                "{\"type\":\"chooseRow\",\"promptId\":\"p\",\"row\":null}",
                "{\"type\":\"pass\",\"promptId\":null}",
                "{\"type\":\"ping\",\"unexpected\":true}", "{\"type\":\"ping\"} {}"}) {
            assertThrows(JacksonException.class, () -> codec.read(json), json);
        }
    }
    @Test void acceptsValidMessages() throws Exception {
        assertInstanceOf(ClientMessage.Auth.class, codec.read("{\"type\":\"auth\",\"token\":\"valid\"}"));
        assertInstanceOf(ClientMessage.Ping.class, codec.read("{\"type\":\"ping\"}"));
    }
}
