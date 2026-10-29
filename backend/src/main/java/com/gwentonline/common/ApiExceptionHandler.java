package com.gwentonline.common;

import com.gwentonline.player.InvalidNicknameException;
import com.gwentonline.player.NicknameTakenException;
import com.gwentonline.player.ServerFullException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

/** RFC 7807 problem responses with a stable {@code code} property for the client's translations. */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NicknameTakenException.class)
    ProblemDetail nicknameTaken(NicknameTakenException e) {
        return problem(HttpStatus.CONFLICT, e.code());
    }

    @ExceptionHandler(InvalidNicknameException.class)
    ProblemDetail invalidNickname(InvalidNicknameException e) {
        return problem(HttpStatus.BAD_REQUEST, e.code());
    }

    @ExceptionHandler(ServerFullException.class)
    ProblemDetail serverFull(ServerFullException e) {
        return problem(HttpStatus.SERVICE_UNAVAILABLE, e.code());
    }

    @ExceptionHandler(ClientRateLimiter.TooManyRequestsException.class)
    ProblemDetail rateLimited(ClientRateLimiter.TooManyRequestsException e) {
        return problem(HttpStatus.TOO_MANY_REQUESTS, e.code());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail invalidBody(MethodArgumentNotValidException e) {
        String code = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getDefaultMessage())
                .filter(message -> message != null && message.matches("[a-zA-Z.]+"))
                .findFirst()
                .orElse("request.invalid");
        return problem(HttpStatus.BAD_REQUEST, code);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ProblemDetail invalidMethodArgument(HandlerMethodValidationException e) {
        return problem(HttpStatus.BAD_REQUEST, "request.invalid");
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ProblemDetail invalidParameter(ConstraintViolationException e) {
        return problem(HttpStatus.BAD_REQUEST, "request.invalid");
    }

    private static ProblemDetail problem(HttpStatus status, String code) {
        ProblemDetail problem = ProblemDetail.forStatus(status);
        problem.setTitle(status.getReasonPhrase());
        problem.setProperty("code", code);
        return problem;
    }
}
