package com.gwentonline.common;

import java.security.SecureRandom;
import java.util.Base64;

/** Unguessable identifiers (session tokens, match and prompt ids). */
public final class SecureIds {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    private SecureIds() {
    }

    /** 256-bit secret, for session tokens. */
    public static String token() {
        return random(32);
    }

    /** 96-bit id, for public identifiers. */
    public static String id() {
        return random(12);
    }

    private static String random(int bytes) {
        byte[] buffer = new byte[bytes];
        RANDOM.nextBytes(buffer);
        return ENCODER.encodeToString(buffer);
    }
}
