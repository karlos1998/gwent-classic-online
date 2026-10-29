package com.gwentonline.protocol;

/**
 * Public profile shown to the opponent. Guests have no avatar and no statistics; accounts (planned, Google
 * sign-in) will fill {@code avatarUrl} and {@code gamesPlayed}.
 */
public record PlayerProfileDto(String nickname, Kind kind, String avatarUrl, Integer gamesPlayed) {

    public enum Kind { GUEST, ACCOUNT }

    public static PlayerProfileDto guest(String nickname) {
        return new PlayerProfileDto(nickname, Kind.GUEST, null, null);
    }
}
