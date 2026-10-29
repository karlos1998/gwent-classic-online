package com.gwentonline.common;

/** Business error with a stable code the client can translate ({@code errors.<code>}). */
public class GwentException extends RuntimeException {

    private final String code;

    public GwentException(String code) {
        super(code, null, false, false);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
