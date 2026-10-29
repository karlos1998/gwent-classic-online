package com.gwentonline.matchmaking;

import com.gwentonline.player.GuestSession;

/** Unordered pair of players (decline cooldown key). */
record PlayerPair(String a, String b) {

    static PlayerPair of(GuestSession x, GuestSession y) {
        String idX = x.getId();
        String idY = y.getId();
        return idX.compareTo(idY) <= 0 ? new PlayerPair(idX, idY) : new PlayerPair(idY, idX);
    }
}
