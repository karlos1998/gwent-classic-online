package com.gwentonline.player;

import com.gwentonline.common.GwentException;

public final class ServerFullException extends GwentException {
    public ServerFullException() {
        super("server.full");
    }
}
