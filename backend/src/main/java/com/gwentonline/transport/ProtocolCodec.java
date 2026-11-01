package com.gwentonline.transport;

import com.fasterxml.jackson.annotation.JsonInclude;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.ObjectWriter;
import tools.jackson.databind.json.JsonMapper;
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
            .changeDefaultPropertyInclusion(inclusion -> inclusion.withValueInclusion(JsonInclude.Include.NON_NULL))
            .build();

    public ClientMessage read(String json) throws JacksonException {
        ClientMessage message = mapper.readValue(json, ClientMessage.class);
        if (message == null) throw tools.jackson.databind.exc.MismatchedInputException.from(
                (tools.jackson.core.JsonParser) null, ClientMessage.class, "Message cannot be null");
        return message;
    }

    public ObjectWriter writer() {
        return mapper.writer();
    }
}
