<template>
  <!-- Markup mirrors the original index.html 1:1 so the original stylesheet applies unchanged.
       Shared by the offline game (local engine) and the online game (server snapshots). -->

  <main :class="{ noclick: ui.mainNoclick }">
    <section
      id="click-background"
      :class="{ noclick: !ui.clickBackgroundActive }"
      @click="ui.cancel()"
    ></section>

    <section id="panel-left" class="panel">
      <button id="exit-game" type="button" :title="$t('game.surrenderHint')" @click="$emit('exit')" @mouseenter="hoverSFX">
        <img :src="flagIcon" alt="" />
        <span>{{ $t('game.surrender') }}</span>
      </button>

      <LeaderBox tag="op" :player="op" />

      <PlayerStats tag="op" :player="op" />

      <div
        id="weather"
        :ref="registerContainer('weather')"
        class="card-container"
        :class="{ 'row-selectable': weather.ui.selectable, noclick: weather.ui.noclick }"
        @click="ui.selectRow(weather)"
      >
        <CardView
          v-for="c in weather.cards"
          :key="c.uid"
          :card="c"
          :margin="weatherMargin"
          @select="ui.selectCard($event)"
        />
      </div>

      <PlayerStats tag="me" :player="me" />

      <LeaderBox tag="me" :player="me" />

      <div
        id="pass-button"
        class="center"
        :class="{ noclick: ui.passNoclick, holding: hold > 0 }"
        :style="{ '--hold': hold }"
        :data-title="$t('game.passRound')"
        @click="ui.passRound()"
        @mouseenter="hoverSFX"
      >
        {{ $t('game.pass') }}
      </div>
    </section>

    <section id="panel-mid" class="panel">
      <section id="field-op" class="field">
        <FieldRow :row="board.row[0]" />
        <FieldRow :row="board.row[1]" />
        <FieldRow :row="board.row[2]" />
      </section>

      <section id="field-me" class="field">
        <FieldRow :row="board.row[3]" />
        <FieldRow :row="board.row[4]" />
        <FieldRow :row="board.row[5]" />
      </section>

      <section id="field-hand">
        <div id="hand-row" :ref="registerContainer('hand-me')" class="card-container card-selectable">
          <template v-if="me">
            <CardView
              v-for="c in sortedHand"
              :key="c.uid"
              :card="c"
              :margin="handMargin"
              @select="ui.selectCard($event)"
            />
          </template>
        </div>
      </section>
    </section>

    <section id="panel-right" class="panel">
      <CardPile kind="grave" tag="op" :player="op" />
      <CardPile kind="deck" tag="op" :player="op" />
      <CardPile kind="grave" tag="me" :player="me" />
      <CardPile kind="deck" tag="me" :player="me" />
    </section>

    <div id="hand-op" :ref="registerContainer('hand-op')"></div>

    <section class="card-preview" :class="{ hide: !ui.previewVisible }">
      <div class="card-lg" :style="previewStyle"></div>
      <CardDescription :card="ui.previewCard" />
    </section>

    <CarouselView />

    <PopupView />

    <section
      id="notification-bar"
      :class="{ hide: ui.notif.hidden }"
      :style="ui.notif.opacity !== null ? { opacity: ui.notif.opacity } : {}"
    >
      <div :id="'notif-' + ui.notif.name" :data-text="ui.notif.name ? $t(notificationKey(ui.notif.name)) : ''"></div>
    </section>

    <EndScreen />

    <section id="deck-selector"></section>
  </main>

</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { Card, ctx } from '@/engine'
import { ui } from '@/ui/store'
import { registerContainer } from '@/ui/dom'
import { HAND_MARGIN, WEATHER_MARGIN } from '@/ui/layout'
import { largeURL, svgPath } from '@/ui/assets'
import { hoverSFX } from '@/ui/audio'
import { ensureEngine } from '@/ui/bootstrap'
import { notificationKey } from '@/i18n/keys'
import { useBoardKeys } from '@/ui/keys'
import CardView from './CardView.vue'
import FieldRow from './FieldRow.vue'
import PlayerStats from './PlayerStats.vue'
import LeaderBox from './LeaderBox.vue'
import CardPile from './CardPile.vue'
import CardDescription from './CardDescription.vue'
import CarouselView from './CarouselView.vue'
import PopupView from './PopupView.vue'
import EndScreen from './EndScreen.vue'

export default defineComponent({
  name: 'GameBoard',
  components: { CardView, FieldRow, PlayerStats, LeaderBox, CardPile, CardDescription, CarouselView, PopupView, EndScreen },
  props: {
  },
  emits: ['exit'],
  setup(_props, { emit }) {
    const state = ensureEngine()
    const { hold } = useBoardKeys(() => emit('exit'))
    // ctx.me / ctx.op are re-assigned when a game starts; expose them reactively
    const me = computed(() => state.me)
    const op = computed(() => state.op)
    const sortedHand = computed(() => (state.me ? [...state.me.hand.cards].sort(Card.compare) : []))
    const handMargin = computed(() => HAND_MARGIN(state.me ? state.me.hand.cards.length : 0))
    const weatherMargin = computed(() => WEATHER_MARGIN(ctx.weather.cards.length))
    const previewStyle = computed(() =>
      ui.previewCard ? { backgroundImage: largeURL(ui.previewCard.faction + '_' + ui.previewCard.filename) } : {},
    )
    return {
      ui,
      hold,
      flagIcon: svgPath('surrender'),
      board: ctx.board,
      weather: ctx.weather,
      me,
      op,
      sortedHand,
      handMargin,
      weatherMargin,
      previewStyle,
      registerContainer,
      hoverSFX,
      notificationKey,
    }
  },
})
</script>

<style>
/* surrender button (replaces the original exit icon) */
#exit-game {
  top: 1.1vw;
  left: 1vw;
  width: auto;
  height: auto;
  display: flex;
  align-items: center;
  gap: 0.45vw;
  padding: 0.35vw 0.8vw 0.35vw 0.55vw;
  font-family: inherit;
  font-size: 0.85vw;
  letter-spacing: 0.06em;
  color: #c9a98a;
  background: linear-gradient(rgba(40, 18, 12, 0.85), rgba(18, 9, 6, 0.9));
  background-image: linear-gradient(rgba(40, 18, 12, 0.85), rgba(18, 9, 6, 0.9));
  border: 0.08vw solid #6b2a1c;
  border-radius: 0.2vw;
  box-shadow: 0 0 0.4vw rgba(0, 0, 0, 0.7);
  opacity: 0.8;
  cursor: pointer;
  transition: opacity 0.15s, box-shadow 0.15s, color 0.15s;
}
#exit-game img {
  width: 1vw;
  height: 1vw;
}
#exit-game:hover {
  opacity: 1;
  color: #f0d2c4;
  box-shadow: 0 0 0.8vw rgba(160, 56, 42, 0.6);
  filter: none;
}

/* hold Space to pass: the button fills up like the original's hold prompt */
#pass-button.holding::before {
  content: '';
  position: absolute;
  inset: 0;
  transform-origin: left;
  transform: scaleX(var(--hold));
  background: linear-gradient(90deg, rgba(218, 165, 32, 0.15), rgba(218, 165, 32, 0.45));
  pointer-events: none;
}
#pass-button.holding {
  box-shadow: 0 0 0.8vw rgba(218, 165, 32, calc(var(--hold) * 0.9));
}
</style>
