package com.gwentonline.game.room;

import com.gwentonline.game.engine.GameEvent;
import com.gwentonline.game.engine.Notice;
import com.gwentonline.game.engine.PlayerState;
import com.gwentonline.protocol.FxDto;

import java.util.Optional;
import java.util.Set;

/** Translates engine events into recipient-relative client effects ("me-turn" vs "op-turn" ...). */
final class EventTranslator {

    private EventTranslator() {
    }

    /**
     * @param visibleIds cards the recipient may know (animations of hidden cards are dropped as defense in depth)
     */
    static Optional<FxDto> translate(GameEvent event, PlayerState recipient, Set<Integer> visibleIds) {
        return switch (event) {
            case GameEvent.Notification n -> Optional.of(new FxDto.Notification(notificationKey(n.notice(), n.subject(), recipient)));
            case GameEvent.Sound s -> Optional.of(new FxDto.Sound(soundKey(s.key(), s.subject(), recipient)));
            case GameEvent.CardAnimation a -> visibleIds.contains(a.card().getId())
                    ? Optional.of(new FxDto.Animation(a.card().getId(), a.animation()))
                    : Optional.empty();
            case GameEvent.CardPreview p -> Optional.of(new FxDto.Preview(SnapshotFactory.card(p.card()), p.durationMs()));
            case GameEvent.Reveal r -> Optional.of(new FxDto.Reveal(SnapshotFactory.cards(r.cards()), r.titleKey()));
        };
    }

    static String notificationKey(Notice notice, PlayerState subject, PlayerState recipient) {
        String tag = subject == recipient ? "me" : "op";
        return switch (notice) {
            case COIN -> tag + "-coin";
            case FIRST -> tag + "-first";
            case SCOIATAEL_CHOSE_SELF -> "scoiatael";
            case ROUND_START -> "round-start";
            case TURN -> tag + "-turn";
            case PASS -> tag + "-pass";
            case ROUND_RESULT -> subject == null ? "draw-round" : subject == recipient ? "win-round" : "lose-round";
            case NORTH -> "north";
            case MONSTERS -> "monsters";
            case SKELLIGE -> "skellige-" + tag;
        };
    }

    static String soundKey(String key, PlayerState subject, PlayerState recipient) {
        return switch (key) {
            case "turn" -> subject == recipient ? "turn_me" : "turn_op";
            case "round_result" -> subject == recipient ? "round_win" : "round_lose";
            case "game_result" -> subject == recipient ? "game_win" : "game_lose";
            default -> key;
        };
    }
}
