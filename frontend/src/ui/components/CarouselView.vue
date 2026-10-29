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
import { computed, defineComponent } from 'vue'
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
    return { curr, view, slots, large, onSlotClick }
  },
})
</script>
