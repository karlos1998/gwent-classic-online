package com.gwentonline.player;

import com.gwentonline.common.GwentException;

public final class InvalidNicknameException extends GwentException {
    public InvalidNicknameException(String code) {
        super(code);
    }
}
