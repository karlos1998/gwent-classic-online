<template>
  <div id="music-host" v-once><div id="youtube"></div></div>
  <AssetLoading v-if="!assetLoading.ready" />
  <template v-else>
    <RouterView />
    <SettingsMenu />
    <LanguageSwitcher />
    <CardInspector />
  </template>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted } from 'vue'
import LanguageSwitcher from './ui/components/LanguageSwitcher.vue'
import CardInspector from './ui/components/CardInspector.vue'
import SettingsMenu from './ui/components/SettingsMenu.vue'
import { inspector, inspectCard, closeInspector } from './ui/inspect'
import { cardAtPoint } from './ui/dom'
import { ui, type CarouselItem } from './ui/store'
import { installTouch } from './ui/touch'
import AssetLoading from './ui/components/AssetLoading.vue'
import { assetLoading, preloadAssets } from './ui/preload'
import { music } from './ui/music'

/** the board is covered by a menu / overlay, so the cards under the cursor are not visible */
const boardCovered = () =>
  ui.customizationVisible || ui.carouselView.visible || ui.popupState.visible || !ui.endScreen.hidden

// Right mouse button = inspect a card (like in The Witcher 3) instead of the browser's context menu.
// Text fields keep the normal menu (copy / paste).
function onContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"]')) return
  e.preventDefault()
  if (inspector.card) return closeInspector()
  if (boardCovered()) return
  inspectCard(cardAtPoint<CarouselItem>(e.clientX, e.clientY))
}

export default defineComponent({
  name: 'App',
  components: { AssetLoading, LanguageSwitcher, CardInspector, SettingsMenu },
  setup() {
    onMounted(() => {
      void preloadAssets()
      music.init()
      installTouch()
      document.addEventListener('contextmenu', onContextMenu)
    })
    onBeforeUnmount(() => document.removeEventListener('contextmenu', onContextMenu))
    return { assetLoading }
  },
})
</script>

<style>
/* upright phone on a board screen: the whole app is drawn turned by 90° (see ui/stage.ts) */
html.gwent-rotated #app {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--vp-h);
  height: var(--vp-w);
  overflow: hidden;
  transform-origin: 0 0;
  transform: translateX(var(--vp-w)) rotate(90deg);
}

/* overlays outside the stage are sized in vw: on the turned app vw has to mean the long side */
html.gwent-rotated .match-found,
html.gwent-rotated .toast-stack {
  zoom: var(--rot-z);
}

/* touch screens: no text selection, magnifier, callouts or double-tap zoom while playing */
html.touch body {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
html.touch input,
html.touch textarea {
  -webkit-user-select: text;
  user-select: text;
}

/* long press feedback: a gold ring fills under the finger */
.touch-hold-ring {
  position: fixed;
  z-index: 5000;
  width: 64px;
  height: 64px;
  margin: -32px 0 0 -32px;
  pointer-events: none;
  animation: thr-in 0.12s ease-out;
}
.touch-hold-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  overflow: visible;
}
.touch-hold-ring circle {
  fill: rgba(0, 0, 0, 0.25);
  stroke: goldenrod;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 107;
  stroke-dashoffset: 107;
  filter: drop-shadow(0 0 4px rgba(218, 165, 32, 0.8));
  animation: thr-fill var(--hold) linear forwards;
}
.touch-hold-ring.done {
  animation: thr-out 0.2s ease-out forwards;
}
@keyframes thr-fill {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes thr-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}
@keyframes thr-out {
  to {
    opacity: 0;
    transform: scale(1.5);
  }
}
</style>
