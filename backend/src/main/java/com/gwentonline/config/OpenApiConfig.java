package com.gwentonline.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI description of the REST part (Swagger UI at /swagger-ui.html). The game itself runs over /ws. */
@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

    @Bean
    OpenAPI gwentOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Gwent Classic Online")
                .description("Guest sessions. Gameplay uses the WebSocket endpoint /ws (see README, protocol section).")
                .version("v1")
                .license(new License().name("MIT + Commons Clause")));
    }
}
