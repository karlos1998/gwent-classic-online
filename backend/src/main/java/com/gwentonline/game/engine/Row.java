package com.gwentonline.game.engine;

import lombok.Getter;
import lombok.Setter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

/** A combat row of one player: units, the special slot and active effects (port of the original {@code Row}). */
@Getter
public final class Row extends CardZone {

    private final RowType type;
    private final PlayerState owner;
    private CardInstance special;
    private int total;
    private boolean weather;
    @Setter
    private boolean halfWeather;
    private final Map<String, Integer> bond = new HashMap<>();
    private int morale;
    private int horn;
    private int mardroeme;

    Row(RowType type, PlayerState owner) {
        this.type = type;
        this.owner = owner;
    }

    /** Copy used to evaluate hypothetical placements (agile auto-placement, Francesca "Hope"). */
    Row virtualCopy(Predicate<CardInstance> keep) {
        Row copy = new Row(type, owner);
        copy.weather = weather;
        copy.halfWeather = halfWeather;
        copy.bond.putAll(bond);
        copy.morale = morale;
        copy.horn = horn;
        copy.mardroeme = mardroeme;
        cards.stream().filter(keep).forEach(copy.cards::add);
        cards.stream().filter(keep.negate()).forEach(c -> copy.updateState(c, false));
        return copy;
    }

    void insertUnit(CardInstance card) {
        addSorted(card);
    }

    void setSpecialCard(CardInstance card) {
        this.special = card;
    }

    void setWeather(boolean weather) {
        this.weather = weather;
    }

    /** Updates a card's effect on the row. */
    void updateState(CardInstance card, boolean activate) {
        int delta = activate ? 1 : -1;
        for (String ability : card.getAbilities()) {
            switch (ability) {
                case "morale" -> morale += delta;
                case "horn" -> horn += delta;
                case "mardroeme" -> mardroeme += delta;
                case "bond" -> bond.merge(card.getName(), delta, Integer::sum);
                default -> { /* no row effect */ }
            }
        }
    }

    void changeHorn(int delta) {
        horn += delta;
    }

    /** Current power of a card under this row's effects (original {@code calcCardScore}). */
    int calcCardScore(CardInstance card, boolean doubleSpyPower) {
        int total = card.getBasePower();
        if (card.isHero()) return total;
        if (weather) {
            int weatherMin = halfWeather ? total / 2 : 1;
            total = Math.min(weatherMin, total);
        }
        if (doubleSpyPower && card.hasAbility("spy")) total *= 2;
        Integer bonds = bond.get(card.getName());
        if (bonds != null && bonds > 1) total *= bonds;
        total += Math.max(0, morale + (card.hasAbility("morale") ? -1 : 0));
        if (horn - (card.hasAbility("horn") ? 1 : 0) > 0) total *= 2;
        return total;
    }

    int calcScore(boolean doubleSpyPower) {
        return cards.stream().mapToInt(c -> calcCardScore(c, doubleSpyPower)).sum();
    }

    /** Recomputes card powers and the row total, returns the change of the total. */
    int updateScore(boolean doubleSpyPower) {
        int newTotal = 0;
        for (CardInstance card : cards) {
            int score = calcCardScore(card, doubleSpyPower);
            if (!card.isNamed("Decoy")) card.setPower(score);
            newTotal += score;
        }
        int delta = newTotal - total;
        total = newTotal;
        return delta;
    }

    /** Strongest non-hero units of the row. */
    List<CardInstance> maxUnits() {
        int max = cards.stream().filter(CardInstance::isUnit).mapToInt(CardInstance::getPower).max().orElse(Integer.MIN_VALUE);
        return cards.stream().filter(c -> c.isUnit() && c.getPower() == max).toList();
    }

    void resetEffects() {
        special = null;
        total = 0;
        weather = false;
        bond.clear();
        morale = 0;
        horn = 0;
        mardroeme = 0;
        cards.clear();
    }
}
