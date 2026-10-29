package com.gwentonline.game.engine;

/**
 * Where a card is played, relative to the acting player. The ordinal matches the client's board
 * row index (0-2 opponent siege/ranged/close, 3-5 own close/ranged/siege) followed by the weather slot.
 */
public enum BoardSlot {
    OPPONENT_SIEGE(false, RowType.SIEGE),
    OPPONENT_RANGED(false, RowType.RANGED),
    OPPONENT_CLOSE(false, RowType.CLOSE),
    OWN_CLOSE(true, RowType.CLOSE),
    OWN_RANGED(true, RowType.RANGED),
    OWN_SIEGE(true, RowType.SIEGE),
    WEATHER(false, null);

    private final boolean own;
    private final RowType rowType;

    BoardSlot(boolean own, RowType rowType) {
        this.own = own;
        this.rowType = rowType;
    }

    public boolean isOwn() {
        return own;
    }

    public boolean isWeather() {
        return this == WEATHER;
    }

    public RowType rowType() {
        return rowType;
    }

    public static BoardSlot of(boolean own, RowType type) {
        return switch (type) {
            case CLOSE -> own ? OWN_CLOSE : OPPONENT_CLOSE;
            case RANGED -> own ? OWN_RANGED : OPPONENT_RANGED;
            case SIEGE -> own ? OWN_SIEGE : OPPONENT_SIEGE;
        };
    }
}
