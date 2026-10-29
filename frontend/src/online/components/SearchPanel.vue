<template>
  <!-- Matchmaking in progress (Rocket League style): elapsed time, cancel any time -->
  <div class="search-panel" role="status" aria-live="polite">
    <div class="sp-spinner" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
    <div class="sp-text">
      <div class="sp-title">{{ $t('online.search.title') }}</div>
      <div class="sp-sub">{{ $t('online.search.hint') }}</div>
    </div>
    <div class="sp-time">{{ elapsed }}</div>
    <button class="sp-cancel" @click="online.cancelSearch()" @mouseenter="hoverSFX">{{ $t('online.search.cancel') }}</button>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { online } from '../session'
import { formatElapsed, useNowMs } from '../clock'
import { hoverSFX } from '@/ui/audio'

export default defineComponent({
  name: 'SearchPanel',
  setup() {
    const now = useNowMs()
    const elapsed = computed(() => formatElapsed(online.search ? now.value - online.search.since : 0))
    return { online, elapsed, hoverSFX }
  },
})
</script>

<style>
.search-panel {
  position: absolute;
  top: 0.8vw;
  left: 50%;
  transform: translateX(-50%);
  z-index: 96;
  display: flex;
  align-items: center;
  gap: 1.1vw;
  padding: 0.7vw 1.1vw;
  min-width: 30vw;
  font-size: 1vw;
  color: tan;
  background: linear-gradient(rgba(28, 22, 13, 0.97), rgba(12, 10, 8, 0.97));
  border: 0.12vw solid #6d5210;
  box-shadow: 0 0 1.4vw rgba(218, 165, 32, 0.28), 0 0.4vw 1.2vw rgba(0, 0, 0, 0.7);
  animation: sp-in 0.25s ease-out;
}
@keyframes sp-in {
  from {
    opacity: 0;
    transform: translate(-50%, -0.6vw);
  }
}
.sp-spinner {
  position: relative;
  width: 2.4vw;
  height: 2.4vw;
  flex: 0 0 auto;
}
.sp-spinner span {
  position: absolute;
  inset: 0;
  border: 0.18vw solid transparent;
  border-top-color: goldenrod;
  border-radius: 50%;
  animation: sp-spin 1.2s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite;
}
.sp-spinner span:nth-child(2) {
  inset: 0.35vw;
  border-top-color: #c97a1e;
  animation-duration: 1.6s;
  animation-direction: reverse;
}
.sp-spinner span:nth-child(3) {
  inset: 0.75vw;
  border-top-color: #9f7d3e;
  animation-duration: 0.9s;
}
@keyframes sp-spin {
  to {
    transform: rotate(360deg);
  }
}
.sp-text {
  flex: 1;
  min-width: 0;
}
.sp-title {
  font-size: 1.15vw;
  font-weight: bold;
  color: goldenrod;
  letter-spacing: 0.04em;
}
.sp-sub {
  font-size: 0.75vw;
  color: #8f8068;
  margin-top: 0.15vw;
}
.sp-time {
  font-size: 1.6vw;
  font-variant-numeric: tabular-nums;
  color: #e8d3a4;
  min-width: 4vw;
  text-align: right;
}
.sp-cancel {
  font: inherit;
  font-size: 0.85vw;
  color: #e0b9a8;
  background: rgba(80, 20, 12, 0.35);
  border: 0.08vw solid #7a2c1c;
  padding: 0.35vw 0.9vw;
  cursor: pointer;
}
.sp-cancel:hover {
  color: #fff;
  background: rgba(140, 36, 20, 0.6);
}
</style>
