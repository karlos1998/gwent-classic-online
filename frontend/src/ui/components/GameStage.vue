<template>
  <!-- 16:9 game area, scaled to fit the window without scrolling -->
  <div class="stage-viewport">
    <div class="stage" :style="{ zoom: stage.zoom }">
      <slot />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted } from 'vue'
import { stage } from '../stage'

export default defineComponent({
  name: 'GameStage',
  setup() {
    onMounted(() => document.body.classList.add('gwent-board'))
    onBeforeUnmount(() => document.body.classList.remove('gwent-board'))
    return { stage }
  },
})
</script>

<style>
body.gwent-board {
  overflow: hidden;
}
.stage-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: black;
}
.stage {
  position: relative;
  flex: 0 0 auto;
  width: 100vw;
  height: calc(100vw * 1080 / 1920);
  overflow: hidden;
}
</style>
