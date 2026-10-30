<template>
  <section id="popup" class="center" :class="{ hide: !p.visible }" :style="{ backgroundColor: bg }">
    <div>
      <h3>{{ p.title ? $t(p.title) : '' }}</h3>
      <p>{{ p.description ? $t(p.description) : '' }}</p>
      <div>
        <button class="pp-yes" @click="ui.popupSelect(true)" @mouseenter="hoverSFX">{{ $t(p.yesName) }}</button>
        <button class="pp-no" @click="ui.popupSelect(false)" @mouseenter="hoverSFX">{{ $t(p.noName) }}</button>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { ui } from '../store'
import { hoverSFX } from '../audio'

export default defineComponent({
  name: 'PopupView',
  setup() {
    const p = ui.popupState
    const bg = computed(() => `rgba(10,10,10,${p.alpha})`)
    return { ui, p, bg, hoverSFX }
  },
})
</script>

<style>
/* restyled dialog (the original one was a plain grey box with green / red text buttons) */
#popup.center > div {
  margin-top: 0;
  width: 30vw;
  padding: 1.6vw 2vw 1.8vw;
  text-align: center;
  background: linear-gradient(#211b12, #0e0c09);
  border: 0.12vw solid #6d5210;
  box-shadow: 0 0 2.4vw rgba(218, 165, 32, 0.18), 0 1vw 3vw #000;
}
#popup.center h3 {
  margin: 0 0 0.6vw;
  font-size: 1.5vw;
  line-height: 1.2;
  letter-spacing: 0.04em;
  text-transform: none;
  color: goldenrod;
  text-shadow: 0 0 1vw rgba(218, 165, 32, 0.3);
}
#popup.center p {
  margin: 0 0 1.4vw;
  padding: 0;
  font-size: 1.05vw;
  color: #ab977c;
}
#popup.center > div > div {
  top: 0;
  margin: 0;
  width: auto;
  padding: 0;
  gap: 1vw;
  justify-content: center;
  border: 0;
  background: transparent;
}
#popup.center button {
  height: auto;
  min-width: 9vw;
  margin: 0;
  padding: 0.55vw 1.4vw;
  font-family: inherit;
  font-size: 1vw;
  font-weight: bold;
  letter-spacing: 0.05em;
  text-transform: none;
  text-shadow: 0 0.08vw 0.1vw #000;
  cursor: pointer;
  border: 0.1vw solid;
  border-radius: 0.15vw;
  transition: box-shadow 0.15s, filter 0.15s;
}
#popup.center button.pp-yes {
  color: #f3e2b4;
  background: linear-gradient(#4a3812, #241a07);
  border-color: #b8892a;
}
#popup.center button.pp-no {
  color: #e0b9a8;
  background: linear-gradient(#3a160f, #1c0b07);
  border-color: #7a2c1c;
}
#popup.center button:hover {
  filter: brightness(1.2);
  box-shadow: 0 0 1vw rgba(218, 165, 32, 0.35);
}
</style>
