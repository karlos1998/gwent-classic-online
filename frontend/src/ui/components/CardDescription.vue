<template>
  <div class="card-description" :class="{ hide: d.hidden }">
    <div :style="d.icon ? { backgroundImage: d.icon } : {}"></div>
    <h1>{{ d.title }}</h1>
    <p>{{ d.text }}</p>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { describe, type CarouselItem } from '../store'

export default defineComponent({
  name: 'CardDescription',
  props: {
    card: { type: Object as PropType<CarouselItem | null>, default: null },
  },
  setup(props) {
    const d = computed(() => describe(props.card))
    return { d }
  },
})
</script>
