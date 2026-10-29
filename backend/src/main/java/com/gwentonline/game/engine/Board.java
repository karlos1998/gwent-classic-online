package com.gwentonline.game.engine;

import com.gwentonline.game.engine.card.CardCatalog;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

/** Rows, weather and card movement between zones (port of the original {@code Board}, {@code Row} and {@code Weather}). */
final class Board {

    private final GwentGame game;
    private final List<Map<RowType, Row>> rows = new ArrayList<>(2);
    private final WeatherZone weather = new WeatherZone();

    Board(GwentGame game, PlayerState seat0, PlayerState seat1) {
        this.game = game;
        for (PlayerState player : List.of(seat0, seat1)) {
            Map<RowType, Row> side = new EnumMap<>(RowType.class);
            for (RowType type : RowType.values()) side.put(type, new Row(type, player));
            rows.add(side);
        }
    }

    // ------------------------------------------------------------------ lookup

    Row row(PlayerState side, RowType type) {
        return rows.get(side.getSeat()).get(type);
    }

    Stream<Row> rowsOf(PlayerState side) {
        return rows.get(side.getSeat()).values().stream();
    }

    Stream<Row> allRows() {
        return rows.stream().flatMap(side -> side.values().stream());
    }

    WeatherZone weather() {
        return weather;
    }

    /** Row a card is sent to (spies go to the opponent's side), same as the original {@code getRow}. */
    Row rowFor(CardInstance card, RowType type, PlayerState player) {
        PlayerState owner = player != null ? player : card.getHolder();
        boolean spy = card.hasAbility("spy");
        return row(spy ? owner.getOpponent() : owner, type);
    }

    Optional<Row> rowContaining(CardInstance card) {
        return allRows().filter(r -> r.contains(card) || r.getSpecial() == card).findFirst();
    }

    // ------------------------------------------------------------------ movement

    void toGrave(CardInstance card, CardZone source) {
        moveTo(card, card.getHolder().getGrave(), source);
    }

    void toHand(CardInstance card, CardZone source) {
        moveTo(card, card.getHolder().getHand(), source);
    }

    void toDeck(CardInstance card, CardZone source) {
        moveTo(card, card.getHolder().getDeck(), source);
    }

    /** Plays a card to the row from its data (agile cards of human players default to close combat). */
    void toRow(CardInstance card, CardZone source) {
        if (card.isWeather()) {
            moveTo(card, weather, source);
            return;
        }
        RowType type = card.isAgile() ? RowType.CLOSE : RowType.fromKey(card.getRow()).orElse(RowType.CLOSE);
        moveTo(card, rowFor(card, type, card.getHolder()), source);
    }

    /** Takes a card out of its source, shows it flying to the destination and runs the arrival effects. */
    void moveTo(CardInstance card, CardZone destination, CardZone source) {
        if (source != null) take(card, source);
        arrive(card, destination, true);
    }

    /** Puts a card on the board that was not in any zone (summons, muster after it was taken from hand/deck). */
    void summon(CardInstance card, Row row, boolean withFlight) {
        arrive(card, row, withFlight);
    }

    void draw(PlayerState player) {
        if (player.getDeck().isEmpty()) return;
        toHand(player.getDeck().top(), player.getDeck());
    }

    private void take(CardInstance card, CardZone source) {
        switch (source) {
            case Row row -> removeFromRow(row, card);
            case WeatherZone w -> removeWeather(card);
            default -> source.remove(card);
        }
        game.changed();
    }

    private void arrive(CardInstance card, CardZone destination, boolean withFlight) {
        switch (destination) {
            case Row row -> addToRow(row, card, withFlight);
            case WeatherZone w -> addWeather(card);
            default -> {
                destination.add(card);
                game.changed();
                if (withFlight) game.pacer().pause(Pacing.FLIGHT);
            }
        }
    }

    // ------------------------------------------------------------------ rows

    void addToRow(Row row, CardInstance card, boolean withFlight) {
        if (card.isSpecial()) {
            row.setSpecialCard(card);
        } else {
            row.insertUnit(card);
        }
        game.changed();
        if (withFlight) game.pacer().pause(Pacing.FLIGHT);
        if (!card.isSpecial()) placementSound(row, card);
        row.updateState(card, true);
        for (String ability : List.copyOf(card.getPlacedAbilities())) {
            game.effects().placed(ability, card, row);
        }
        game.pacer().pause(Pacing.PLACED);
        updateScore(row);
    }

    void removeFromRow(Row row, CardInstance card) {
        if (card.isSpecial() && row.getSpecial() == card) {
            row.setSpecialCard(null);
        } else {
            row.remove(card);
            card.resetPower();
        }
        row.updateState(card, false);
        for (String ability : List.copyOf(card.getRemovedAbilities())) {
            game.effects().removed(ability, card);
        }
        card.getRemovedHooks().forEach(Runnable::run);
        updateScore(row);
    }

    void updateScore(Row row) {
        int delta = row.updateScore(game.isDoubleSpyPower());
        row.getOwner().addToTotal(delta);
        game.updateLeading();
        game.changed();
    }

    private void placementSound(Row row, CardInstance card) {
        if (card.hasAbility("spy") || card.hasAbility("vildkarrl")) return;
        if (card.hasAbility("berserker") && row.getMardroeme() >= 1) return;
        String key;
        if (card.hasAbility("decoy")) key = "decoy";
        else if (card.isHero()) key = "hero";
        else key = "common_" + row.getType().key();
        game.sound(key, null, Audience.EVERYONE);
        game.pacer().pause(Pacing.PLACEMENT_SOUND);
    }

    /** Local scorch of a row (Villentretenmerth, leaders): kills its strongest units if the row has 10+ points. */
    void scorchRow(Row row) {
        if (row.getTotal() < GameRules.SCORCH_ROW_THRESHOLD) return;
        List<CardInstance> targets = row.maxUnits();
        game.pacer().parallel(targets.stream().<Runnable>map(c -> () -> {
            game.animate(c, "scorch");
            toGrave(c, row);
        }).toList());
    }

    /** Leader horn: a temporary Commander's Horn that is removed at the end of the round. */
    void leaderHorn(Row row) {
        if (row.getSpecial() != null) return;
        CardInstance horn = game.createCard(game.catalog().get(CardCatalog.COMMANDERS_HORN), row.getOwner());
        addToRow(row, horn, false);
        game.onRoundEnd(() -> {
            removeFromRow(row, horn);
            return true;
        });
    }

    /** Removes everything from a row except cards kept by the Monsters perk. */
    void clearRow(Row row) {
        List<CardInstance> toGrave = new ArrayList<>(row.cards().stream().filter(c -> !c.isNoRemove()).toList());
        if (row.getSpecial() != null) toGrave.add(row.getSpecial());
        game.pacer().parallel(toGrave.stream().<Runnable>map(c -> () -> toGrave(c, row)).toList());
    }

    // ------------------------------------------------------------------ weather

    private void addWeather(CardInstance card) {
        boolean duplicate = weather.cards().stream().anyMatch(c -> c.getName().equals(card.getName()));
        weather.addFront(card);
        game.changed();
        game.pacer().pause(Pacing.FLIGHT);
        game.sound(card.getAbilities().isEmpty() ? null : card.getAbilities().getLast(), null, Audience.EVERYONE);
        if (card.isNamed("Clear Weather")) {
            game.pacer().pause(Pacing.CLEAR_WEATHER);
            clearWeather();
        } else {
            for (String ability : card.getAbilities()) {
                RowType.fromWeather(ability).filter(weather::activate).ifPresent(type -> setWeather(type, true));
            }
            if (duplicate) {
                game.pacer().pause(Pacing.WEATHER_DUPLICATE);
                toGrave(card, weather);
            }
        }
        game.pacer().pause(Pacing.WEATHER);
    }

    private void removeWeather(CardInstance card) {
        weather.remove(card);
        for (String ability : card.getAbilities()) {
            RowType.fromWeather(ability).filter(weather::deactivate).ifPresent(type -> setWeather(type, false));
        }
    }

    private void setWeather(RowType type, boolean active) {
        for (int seat = 0; seat < 2; seat++) {
            Row row = rows.get(seat).get(type);
            row.setWeather(active);
            updateScore(row);
        }
    }

    void clearWeather() {
        List<CardInstance> cards = new ArrayList<>(weather.cards());
        Collections.reverse(cards);
        game.pacer().parallel(cards.stream().<Runnable>map(c -> () -> toGrave(c, weather)).toList());
    }

    /** End of round: weather first, then all rows (original {@code clearRound}). */
    void clearRound() {
        clearWeather();
        game.pacer().parallel(allRows().<Runnable>map(r -> () -> clearRow(r)).toList());
    }
}
