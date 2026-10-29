<template>
  <!-- Both players are asked whether they want to play each other -->
  <div class="match-found" role="dialog" aria-modal="true" :aria-label="$t('online.match.title')">
    <div class="mf-box">
      <p class="mf-kicker">{{ $t('online.match.kicker') }}</p>
      <h2 class="mf-title">{{ $t('online.match.title') }}</h2>

      <div class="mf-versus">
        <PlayerCard v-if="online.profile" :profile="online.profile" :show-stats="false" class="mf-self" />
        <span class="mf-vs">{{ $t('online.match.vs') }}</span>
        <PlayerCard :profile="match.opponent" class="mf-opponent" />
      </div>

      <div class="mf-status">
        <span :class="{ ok: match.youAccepted }">{{ $t(match.youAccepted ? 'online.match.youAccepted' : 'online.match.youPending') }}</span>
        <span :class="{ ok: match.opponentAccepted }">
          {{ $t(match.opponentAccepted ? 'online.match.opponentAccepted' : 'online.match.opponentPending') }}
        </span>
      </div>

      <div class="mf-countdown">
        <div class="mf-countdown-fill" :style="{ transform: 'scaleX(' + fraction + ')' }"></div>
      </div>
      <div class="mf-seconds">{{ secondsLeft }}</div>

      <div class="mf-actions">
        <button class="mf-accept" :disabled="match.responded" @click="online.respond(true)" @mouseenter="hoverSFX">
          {{ $t(match.youAccepted ? 'online.match.waiting' : 'online.match.accept') }}
        </button>
        <button class="mf-decline" :disabled="match.responded" @click="online.respond(false)" @mouseenter="hoverSFX">
          {{ $t('online.match.decline') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { online, type PendingMatch } from '../session'
import { useNow } from '../clock'
import { hoverSFX } from '@/ui/audio'
import PlayerCard from './PlayerCard.vue'

export default defineComponent({
  name: 'MatchFoundDialog',
  components: { PlayerCard },
  props: {
    match: { type: Object as PropType<PendingMatch>, required: true },
  },
  setup(props) {
    const now = useNow(100)
    const left = computed(() => Math.max(0, props.match.endsAt - now.value))
    const fraction = computed(() => (props.match.timeoutMs ? left.value / props.match.timeoutMs : 0))
    const secondsLeft = computed(() => Math.ceil(left.value / 1000))
    return { online, fraction, secondsLeft, hoverSFX }
  },
})
</script>

<style>
.match-found {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(5, 4, 3, 0.78);
  animation: mf-fade 0.2s ease-out;
}
@keyframes mf-fade {
  from {
    opacity: 0;
  }
}
.mf-box {
  width: 46vw;
  padding: 2vw 2.4vw 1.8vw;
  text-align: center;
  color: tan;
  background: linear-gradient(#1f1a12, #0d0b08);
  border: 0.15vw solid #6d5210;
  box-shadow: 0 0 3vw rgba(218, 165, 32, 0.25), 0 1vw 3vw #000;
  animation: mf-pop 0.3s cubic-bezier(0.2, 1.4, 0.4, 1);
}
@keyframes mf-pop {
  from {
    transform: scale(0.92);
  }
}
.mf-kicker {
  margin: 0;
  font-size: 0.8vw;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: #9f7d3e;
}
.mf-title {
  margin: 0.3vw 0 1.6vw;
  font-size: 2.3vw;
  color: goldenrod;
  text-shadow: 0 0 1.2vw rgba(218, 165, 32, 0.4);
}
.mf-versus {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1.2vw;
  text-align: left;
}
.mf-self {
  justify-content: flex-end;
  flex-direction: row-reverse;
  text-align: right;
}
.mf-self .pc-meta {
  justify-content: flex-end;
}
.mf-vs {
  font-size: 1.6vw;
  font-weight: bold;
  color: #c97a1e;
  font-style: italic;
}
.mf-status {
  display: flex;
  justify-content: space-between;
  margin: 1.6vw 0 0.8vw;
  font-size: 0.85vw;
  color: #8f8068;
}
.mf-status .ok {
  color: #8fd19e;
}
.mf-countdown {
  height: 0.35vw;
  background: #2a2216;
  overflow: hidden;
}
.mf-countdown-fill {
  height: 100%;
  background: linear-gradient(90deg, #c0392b, #e08a1e 35%, goldenrod);
  transform-origin: left;
  transition: transform 0.1s linear;
}
.mf-seconds {
  margin-top: 0.4vw;
  font-size: 0.9vw;
  color: #ab977c;
  font-variant-numeric: tabular-nums;
}
.mf-actions {
  display: flex;
  gap: 1vw;
  justify-content: center;
  margin-top: 1.2vw;
}
.mf-actions button {
  font: inherit;
  font-size: 1.15vw;
  font-weight: bold;
  padding: 0.7vw 2vw;
  min-width: 12vw;
  cursor: pointer;
  border: 0.12vw solid;
  transition: box-shadow 0.15s, opacity 0.15s;
}
.mf-accept {
  color: #f3e2b4;
  background: linear-gradient(#5a4515, #2e230b);
  border-color: goldenrod;
}
.mf-accept:hover:not(:disabled) {
  box-shadow: 0 0 1.4vw rgba(218, 165, 32, 0.6);
}
.mf-decline {
  color: #e0b9a8;
  background: linear-gradient(#3a160f, #1c0b07);
  border-color: #7a2c1c;
}
.mf-decline:hover:not(:disabled) {
  box-shadow: 0 0 1.2vw rgba(192, 57, 43, 0.5);
}
.mf-actions button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
