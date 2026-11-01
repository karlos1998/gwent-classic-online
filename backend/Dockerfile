# syntax=docker/dockerfile:1
# ---- build ----
FROM gradle:8.14.3-jdk21 AS build
WORKDIR /src
COPY settings.gradle.kts build.gradle.kts lombok.config ./
RUN gradle --no-daemon -q dependencies > /dev/null || true
COPY src ./src
RUN gradle --no-daemon -q bootJar -x test

# ---- runtime ----
FROM eclipse-temurin:24-jre-alpine
RUN addgroup -S gwent && adduser -S -G gwent gwent
WORKDIR /app
COPY --from=build /src/build/libs/gwent-online-server.jar app.jar
USER gwent
ENV GWENT_SERVER_PORT=47321 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
EXPOSE 47321
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${GWENT_SERVER_PORT}/actuator/health | grep -q '"UP"' || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
