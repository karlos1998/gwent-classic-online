<template>
  <div class="asset-loading" aria-live="polite" :aria-busy="assetLoading.running">
    <div class="asset-loading-panel">
      <p class="asset-loading-kicker">{{ $t('home.kicker') }}</p>
      <h1>{{ $t('home.title') }}</h1>
      <p>{{ $t(assetLoading.running ? 'loading.preparing' : 'loading.failed') }}</p>
      <progress :value="assetLoading.completed" :max="assetLoading.total" :aria-label="$t('loading.progress')"></progress>
      <p class="asset-loading-count">{{ percent }}% · {{ assetLoading.completed }} / {{ assetLoading.total }}</p>
      <p class="asset-loading-note">{{ $t('loading.note') }}</p>
      <button v-if="!assetLoading.running" @click="preloadAssets()">{{ $t('loading.retry') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { assetLoading, preloadAssets } from '../preload'
const percent = computed(() => assetLoading.total ? Math.floor(assetLoading.completed / assetLoading.total * 100) : 100)
</script>

<style scoped>
.asset-loading {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
  background: radial-gradient(ellipse at center, #292015, #0d0c0a 75%);
  color: #d2b48c;
  font: 17px 'Arial Narrow', sans-serif;
  text-align: center;
}
.asset-loading-panel { width: min(100%, 520px); }
.asset-loading-kicker { color: #a88a48; text-transform: uppercase; letter-spacing: 0.2em; }
h1 { color: #daa520; font-size: clamp(32px, 6vw, 60px); margin: 12px 0 32px; }
progress { width: 100%; height: 14px; appearance: none; border: 1px solid #806021; background: #16130e; }
progress::-webkit-progress-bar { background: #16130e; }
progress::-webkit-progress-value { background: linear-gradient(90deg, #805b17, #daa520); }
progress::-moz-progress-bar { background: #daa520; }
.asset-loading-count { color: #dec58e; font-variant-numeric: tabular-nums; }
.asset-loading-note { color: #a39379; font-size: 14px; line-height: 1.5; }
button { border: 1px solid #a88a48; background: #211b10; padding: 12px 24px; color: #e8d3a4; font: inherit; cursor: pointer; }
</style>
