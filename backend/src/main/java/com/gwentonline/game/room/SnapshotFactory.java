package com.gwentonline.game.room;

import com.gwentonline.game.engine.CardInstance;
import com.gwentonline.game.engine.GwentGame;
import com.gwentonline.game.engine.PlayerState;
import com.gwentonline.game.engine.Row;
import com.gwentonline.game.engine.RowType;
import com.gwentonline.protocol.CardDto;
import com.gwentonline.protocol.GameSnapshotDto;
import com.gwentonline.protocol.PlayerProfileDto;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Builds the per-player view of a game. This is the single place that decides what a client may see:
 * own hand yes, opponent's hand and any deck contents never (only their sizes).
 */
final class SnapshotFactory {

    private SnapshotFactory() {
    }

    static GameSnapshotDto snapshot(GwentGame game, int seat, long version, List<PlayerProfileDto> profiles) {
        PlayerState self = game.player(seat);
        PlayerState opponent = self.getOpponent();
        List<GameSnapshotDto.RowDto> rows = List.of(
                row(game.row(opponent, RowType.SIEGE)),
                row(game.row(opponent, RowType.RANGED)),
                row(game.row(opponent, RowType.CLOSE)),
                row(game.row(self, RowType.CLOSE)),
                row(game.row(self, RowType.RANGED)),
                row(game.row(self, RowType.SIEGE)));
        GameSnapshotDto.Side turn = game.turnOwner()
                .map(owner -> owner == self ? GameSnapshotDto.Side.SELF : GameSnapshotDto.Side.OPPONENT)
                .orElse(null);
        return new GameSnapshotDto(version, game.roundCount(), turn,
                player(self, profiles.get(seat), true),
                player(opponent, profiles.get(opponent.getSeat()), false),
                rows, cards(game.weather().cards()));
    }

    /** Ids of all cards the given player is allowed to know about right now. */
    static Set<Integer> visibleCardIds(GwentGame game, int seat) {
        PlayerState self = game.player(seat);
        Set<Integer> ids = new HashSet<>();
        game.players().forEach(p -> {
            ids.add(p.getLeader().getId());
            p.getGrave().cards().forEach(c -> ids.add(c.getId()));
            for (RowType type : RowType.values()) {
                Row row = game.row(p, type);
                row.cards().forEach(c -> ids.add(c.getId()));
                if (row.getSpecial() != null) ids.add(row.getSpecial().getId());
            }
        });
        game.weather().cards().forEach(c -> ids.add(c.getId()));
        self.getHand().cards().forEach(c -> ids.add(c.getId()));
        return ids;
    }

    static CardDto card(CardInstance card) {
        return card == null ? null : new CardDto(card.getId(), card.getIndex(), card.getPower());
    }

    static List<CardDto> cards(List<CardInstance> cards) {
        return cards.stream().map(SnapshotFactory::card).toList();
    }

    private static GameSnapshotDto.PlayerViewDto player(PlayerState player, PlayerProfileDto profile, boolean isRecipient) {
        return new GameSnapshotDto.PlayerViewDto(
                profile,
                player.getFaction().key(),
                card(player.getLeader()),
                player.getLeaderState().name(),
                player.getHealth(),
                player.getTotal(),
                player.isPassed(),
                player.isWinning(),
                player.getHand().size(),
                player.getDeck().size(),
                isRecipient ? cards(player.getHand().cards()) : null,
                cards(player.getGrave().cards()));
    }

    private static GameSnapshotDto.RowDto row(Row row) {
        return new GameSnapshotDto.RowDto(row.getType().key(), row.getTotal(), row.isWeather(), card(row.getSpecial()),
                cards(row.cards()));
    }
}
