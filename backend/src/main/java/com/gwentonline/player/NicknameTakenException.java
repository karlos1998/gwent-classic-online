package com.gwentonline.player;

import com.gwentonline.common.GwentException;

public final class NicknameTakenException extends GwentException {
    public NicknameTakenException() {
        super("nickname.taken");
    }
}
