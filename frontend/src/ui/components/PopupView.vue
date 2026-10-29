<template>
  <section id="popup" class="center" :class="{ hide: !p.visible }" :style="{ backgroundColor: bg }">
    <div>
      <h3>{{ p.title }}</h3>
      <p>{{ p.description }}</p>
      <div>
        <button @click="ui.popupSelect(true)">{{ p.yesName }}</button>
        <button @click="ui.popupSelect(false)">{{ p.noName }}</button>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { ui } from '../store'

export default defineComponent({
  name: 'PopupView',
  setup() {
    const p = ui.popupState
    const bg = computed(() => `rgba(10,10,10,${p.alpha})`)
    return { ui, p, bg }
  },
})
</script>
