<template>
  <RouterView />
  <LanguageSwitcher />
  <CardInspector />
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted } from 'vue'
import LanguageSwitcher from './ui/components/LanguageSwitcher.vue'
import CardInspector from './ui/components/CardInspector.vue'
import { inspector, inspectCard, closeInspector } from './ui/inspect'
import { cardAtPoint } from './ui/dom'
import { ui, type CarouselItem } from './ui/store'

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
  components: { LanguageSwitcher, CardInspector },
  setup() {
    onMounted(() => document.addEventListener('contextmenu', onContextMenu))
    onBeforeUnmount(() => document.removeEventListener('contextmenu', onContextMenu))
  },
})
</script>
