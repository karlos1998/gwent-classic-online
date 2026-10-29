<template>
  <nav class="lang-switch" :aria-label="$t('lang.' + locale)">
    <button
      v-for="l in LOCALES"
      :key="l"
      type="button"
      class="lang-flag"
      :class="{ active: l === locale }"
      :title="$t('lang.' + l)"
      :aria-label="$t('lang.' + l)"
      :aria-pressed="l === locale"
      @click="choose(l)"
      @mouseenter="hoverSFX"
    >
      <img :src="svg('flag_' + l)" alt="" />
    </button>
  </nav>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { i18n, LOCALES, setLocale, type Locale } from '@/i18n'
import { svgPath } from '../assets'
import { hoverSFX } from '../audio'

export default defineComponent({
  name: 'LanguageSwitcher',
  setup() {
    const locale = computed(() => i18n.global.locale.value as Locale)
    const choose = (l: Locale) => setLocale(l)
    return { LOCALES, locale, choose, svg: svgPath, hoverSFX }
  },
})
</script>

<style>
/* top-right, above every game layer (popup / end screen use z-index 1000) */
.lang-switch {
  position: fixed;
  top: max(6px, 0.5vw);
  right: max(8px, 0.6vw);
  z-index: 2000;
  display: flex;
  gap: max(6px, 0.4vw);
}
.lang-flag {
  width: max(30px, 2.1vw);
  height: max(20px, 1.4vw);
  padding: 0;
  border: 1px solid rgba(218, 165, 32, 0.35);
  border-radius: 2px;
  background: transparent;
  overflow: hidden;
  opacity: 0.45;
  filter: grayscale(0.6);
  transition: opacity 0.15s, filter 0.15s, box-shadow 0.15s;
}
.lang-flag img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lang-flag:hover {
  opacity: 0.85;
  filter: none;
}
.lang-flag.active {
  opacity: 1;
  filter: none;
  border-color: goldenrod;
  box-shadow: 0 0 6px rgba(218, 165, 32, 0.6);
}
</style>
