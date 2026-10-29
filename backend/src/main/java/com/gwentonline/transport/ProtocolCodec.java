package com.gwentonline.transport;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.gwentonline.protocol.ClientMessage;
import org.springframework.stereotype.Component;

/**
 * Strict JSON codec of the WebSocket protocol: unknown properties, unknown message types and trailing
 * data are rejected, and there is no default typing - only the listed message records can be created.
 * Kept separate from Spring's ObjectMapper so the REST configuration stays untouched.
 */
@Component
public class ProtocolCodec {

    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
            .serializationInclusion(JsonInclude.Include.NON_NULL)
            .build();

    public ClientMessage read(String json) throws JsonProcessingException {
        return mapper.readValue(json, ClientMessage.class);
    }

    public ObjectWriter writer() {
        return mapper.writer();
    }
}
