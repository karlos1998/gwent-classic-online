package com.gwentonline.player;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Nickname rules: 3-20 characters, letters (any alphabet, so Polish letters are fine) and digits,
 * single inner separators (space, {@code _ - .}), no separator at the start or end, no reserved names.
 * Uniqueness is case-insensitive.
 */
public final class NicknamePolicy {

    public static final int MIN_LENGTH = 3;
    public static final int MAX_LENGTH = 20;

    /** starts with a letter/digit, every separator is followed by a letter/digit */
    private static final Pattern ALLOWED = Pattern.compile("^[\\p{L}\\p{N}](?:[\\p{L}\\p{N}]|[ _.\\-](?=[\\p{L}\\p{N}]))*$");

    private static final Set<String> RESERVED = Set.of(
            "admin", "administrator", "moderator", "mod", "system", "server", "support",
            "guest", "gosc", "gość", "null", "undefined", "anonymous", "gwent", "player");

    private NicknamePolicy() {
    }

    /** Unicode NFKC normalisation (full-width letters, ligatures ...); does not trim. */
    public static String normalize(String raw) {
        return raw == null ? null : Normalizer.normalize(raw, Normalizer.Form.NFKC);
    }

    /** Case-insensitive identity used for uniqueness. */
    public static String key(String nickname) {
        return normalize(nickname).toLowerCase(Locale.ROOT);
    }

    /** @return error code ({@code nickname.*}) or empty if valid */
    public static Optional<String> check(String raw) {
        if (raw == null || raw.isEmpty()) return Optional.of("nickname.required");
        String value = normalize(raw);
        if (!value.equals(value.strip())) return Optional.of("nickname.whitespace");
        int length = value.codePointCount(0, value.length());
        if (length < MIN_LENGTH) return Optional.of("nickname.tooShort");
        if (length > MAX_LENGTH) return Optional.of("nickname.tooLong");
        if (!ALLOWED.matcher(value).matches()) return Optional.of("nickname.invalidCharacters");
        if (RESERVED.contains(value.toLowerCase(Locale.ROOT))) return Optional.of("nickname.reserved");
        return Optional.empty();
    }
}
