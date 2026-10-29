<template>
  <!-- The opponent lost the connection: they have a grace period to come back, otherwise they forfeit -->
  <div class="opponent-away" role="status">
    <span class="oa-dot"></span>
    <span>{{ $t('online.game.opponentAway', { name }) }}</span>
    <strong>{{ left }}</strong>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { formatDuration, useNow } from '../clock'

export default defineComponent({
  name: 'OpponentAway',
  props: {
    endsAt: { type: Number, required: true },
    name: { type: String, default: '' },
  },
  setup(props) {
    const now = useNow(250)
    const left = computed(() => formatDuration(props.endsAt - now.value))
    return { left }
  },
})
</script>

<style>
.opponent-away {
  position: absolute;
  top: 2.6vw;
  left: 50%;
  transform: translateX(-50%);
  z-index: 96;
  display: flex;
  align-items: center;
  gap: 0.7vw;
  padding: 0.5vw 1.1vw;
  font-size: 0.9vw;
  color: #f0d2c4;
  background: rgba(60, 16, 10, 0.92);
  border: 0.08vw solid #a0382a;
  box-shadow: 0 0 1.2vw rgba(160, 56, 42, 0.5);
  pointer-events: none;
}
.opponent-away strong {
  font-variant-numeric: tabular-nums;
  color: #fff;
}
.oa-dot {
  width: 0.6vw;
  height: 0.6vw;
  border-radius: 50%;
  background: #e0664f;
  animation: lb-blink 0.8s infinite alternate;
}
</style>
