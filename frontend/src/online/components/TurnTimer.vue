<template>
  <!-- Turn clock: drains from the end back to the start, gold -> amber -> red as time runs out -->
  <div class="turn-timer" :class="[timer ? 'active' : 'idle', timer?.owner === 'SELF' ? 'self' : 'opponent']" aria-hidden="true">
    <div class="tt-track">
      <div ref="fill" class="tt-fill"></div>
    </div>
    <div v-if="timer" class="tt-label">
      <span>{{ $t(label) }}</span>
      <strong ref="seconds"></strong>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'
import type { TurnTimer } from '../game'
import { formatDuration } from '../clock'

/** colour of the bar for a remaining fraction 0..1 (hue 46 = gold, 30 = amber, 0 = red) */
function color(f: number, self: boolean) {
  const hue = f >= 0.55 ? 46 : f >= 0.25 ? 30 + ((f - 0.25) / 0.3) * 16 : (f / 0.25) * 30
  const sat = self ? 88 : 30
  const light = self ? 52 : 44
  return `hsl(${hue.toFixed(1)}, ${sat}%, ${light}%)`
}

export default defineComponent({
  name: 'TurnTimer',
  props: {
    timer: { type: Object as PropType<TurnTimer | null>, default: null },
  },
  setup(props) {
    const fill = ref<HTMLElement | null>(null)
    const seconds = ref<HTMLElement | null>(null)
    let frame = 0

    // animated outside of Vue's reactivity: one style write per frame
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const el = fill.value
      const t = props.timer
      if (!el) return
      if (!t) {
        el.style.transform = 'scaleX(0)'
        return
      }
      const left = Math.max(0, t.endsAt - performance.now())
      const f = t.timeoutMs > 0 ? Math.min(1, left / t.timeoutMs) : 0
      const self = t.owner === 'SELF'
      const c = color(f, self)
      el.style.transform = `scaleX(${f})`
      el.style.background = `linear-gradient(90deg, ${color(Math.max(0, f - 0.25), self)}, ${c})`
      el.style.boxShadow = self ? `0 0 0.9vw ${c}, 0 0 0.25vw ${c}` : 'none'
      el.classList.toggle('urgent', self && left < 10_000)
      if (seconds.value) seconds.value.textContent = formatDuration(left)
    }

    onMounted(() => (frame = requestAnimationFrame(tick)))
    onBeforeUnmount(() => cancelAnimationFrame(frame))

    const label = computed(() =>
      props.timer?.simultaneous
        ? 'online.timer.redraw'
        : props.timer?.owner === 'SELF'
          ? 'online.timer.yourTurn'
          : 'online.timer.opponentTurn',
    )
    return { fill, seconds, label }
  },
})
</script>

<style>
.turn-timer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 95;
  pointer-events: none;
  transition: opacity 0.3s;
}
.turn-timer.idle {
  opacity: 0;
}
.tt-track {
  height: 0.42vw;
  background: linear-gradient(rgba(0, 0, 0, 0.85), rgba(20, 16, 10, 0.75));
  border-bottom: 0.06vw solid rgba(109, 82, 16, 0.6);
  overflow: hidden;
}
.tt-fill {
  height: 100%;
  width: 100%;
  transform-origin: left center;
  transform: scaleX(0);
  border-radius: 0 0.2vw 0.2vw 0;
}
.tt-fill.urgent {
  animation: tt-pulse 0.5s ease-in-out infinite alternate;
}
@keyframes tt-pulse {
  to {
    filter: brightness(1.45);
  }
}
.tt-label {
  position: absolute;
  top: 0.42vw;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 0.6vw;
  padding: 0.2vw 1vw 0.3vw;
  font-size: 0.78vw;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ab977c;
  background: rgba(10, 8, 6, 0.88);
  border: 0.06vw solid rgba(109, 82, 16, 0.6);
  border-top: 0;
  border-radius: 0 0 0.4vw 0.4vw;
}
.turn-timer.self .tt-label {
  color: goldenrod;
}
.tt-label strong {
  font-size: 1vw;
  font-variant-numeric: tabular-nums;
  color: #e8d3a4;
  letter-spacing: 0;
}
</style>
