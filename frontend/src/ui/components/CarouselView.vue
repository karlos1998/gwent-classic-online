<template>
  <section id="carousel" :class="{ hide: !view.visible }">
    <div
      :class="view.dir ? [view.dir] : []"
      :style="{ '--magnitude': view.magnitude, '--carousel-trans-time': view.transTime }"
      @click="curr && curr.cancel()"
    >
      <div
        v-for="(card, i) in slots"
        :key="i"
        class="card-lg"
        :class="{ hide: !card, noclick: !card }"
        :style="card ? { backgroundImage: large(card) } : {}"
        @click.stop="onSlotClick(i)"
        @mouseover="curr && curr.nudge(i - 2)"
        @mouseout="curr && curr.nudge(0)"
      ></div>
    </div>
    <CardDescription :card="curr ? curr.current ?? null : null" />
    <div :class="{ hide: !curr || !curr.title }">{{ curr?.title ? $t(curr.title) : '' }}</div>
  </section>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted } from 'vue'
import type { Card } from '@/engine'
import CardDescription from './CardDescription.vue'
import { ui } from '../store'
import { largeURL } from '../assets'

export default defineComponent({
  name: 'CarouselView',
  components: { CardDescription },
  setup() {
    const curr = computed(() => ui.carouselCurr)
    const view = ui.carouselView
    const slots = computed<(Card | null)[]>(() => (curr.value ? curr.value.slots : [null, null, null, null, null]))
    const large = (card: Card) => largeURL(card.faction + '_' + card.filename)
    const onSlotClick = (i: number) => {
      const c = curr.value
      if (!c) return
      if (i === 2) c.select()
      else c.shift(i - 2)
    }
    // ← → / A D browse, Enter selects, Esc closes (or finishes the redraw) - like in The Witcher 3
    const onKey = (e: KeyboardEvent) => {
      const c = curr.value
      if (!c || !view.visible || e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') c.shift(-1)
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') c.shift(1)
      else if (key === 'Enter') c.select()
      else if (key === 'Escape') c.cancel()
      else return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    onMounted(() => window.addEventListener('keydown', onKey, true))
    onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))
    return { curr, view, slots, large, onSlotClick }
  },
})
</script>
