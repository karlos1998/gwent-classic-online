package com.gwentonline.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration(proxyBeanMethods = false)
public class TurnstileConfig {
    @Bean
    RestClient turnstileClient(RestClient.Builder builder) {
        var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        var factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(Duration.ofSeconds(5));
        return builder.baseUrl("https://challenges.cloudflare.com").requestFactory(factory).build();
    }
}
