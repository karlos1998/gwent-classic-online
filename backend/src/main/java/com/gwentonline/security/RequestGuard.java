package com.gwentonline.security;

import com.gwentonline.common.ClientRateLimiter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Limits attempts before JSON parsing / Cloudflare calls; also covers anonymous WS upgrades. */
@Component
public class RequestGuard extends OncePerRequestFilter {
    private final ClientRateLimiter limiter;
    public RequestGuard(ClientRateLimiter limiter) { this.limiter = limiter; }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        boolean api = path.startsWith("/api/");
        if (api) response.setHeader("Cache-Control", "no-store");
        try {
            if (api) {
                limiter.check("api:" + request.getRemoteAddr(), 120);
                if (path.equals("/api/v1/sessions") && request.getMethod().equals("POST")) {
                    limiter.check(request.getRemoteAddr());
                }
            } else if (path.equals("/ws")) {
                limiter.check("ws-upgrade:" + request.getRemoteAddr(), 30);
            }
        } catch (ClientRateLimiter.TooManyRequestsException e) {
            response.setStatus(429);
            response.setHeader("Retry-After", "6");
            response.setContentType("application/problem+json");
            response.getWriter().write("{\"status\":429,\"code\":\"rateLimited\"}");
            return;
        }
        if (api && request.getMethod().equals("POST")) {
            final int maxBodyBytes = 16 * 1024;
            byte[] body = request.getInputStream().readNBytes(maxBodyBytes + 1);
            if (body.length > maxBodyBytes) {
                response.setStatus(413);
                response.setContentType("application/problem+json");
                response.getWriter().write("{\"status\":413,\"code\":\"request.invalid\"}");
                return;
            }
            request = new BufferedRequest(request, body);
        }
        chain.doFilter(request, response);
    }
    private static final class BufferedRequest extends jakarta.servlet.http.HttpServletRequestWrapper {
        private final byte[] body;
        BufferedRequest(HttpServletRequest request, byte[] body) { super(request); this.body = body; }
        @Override public jakarta.servlet.ServletInputStream getInputStream() {
            var input = new java.io.ByteArrayInputStream(body);
            return new jakarta.servlet.ServletInputStream() {
                @Override public int read() { return input.read(); }
                @Override public int read(byte[] bytes, int offset, int length) { return input.read(bytes, offset, length); }
                @Override public boolean isFinished() { return input.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(jakarta.servlet.ReadListener listener) {
                    throw new UnsupportedOperationException("Synchronous API requests only");
                }
            };
        }
        @Override public java.io.BufferedReader getReader() {
            return new java.io.BufferedReader(new java.io.InputStreamReader(getInputStream(), java.nio.charset.StandardCharsets.UTF_8));
        }
    }
}
