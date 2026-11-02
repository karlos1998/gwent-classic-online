<template>
  <!-- Gear in the top-right corner: sound / music / messages and the controls, instead of buttons on the board -->
  <div ref="root" class="settings-menu" :class="{ open }">
    <button
      class="sm-gear"
      type="button"
      :title="$t('settings.title')"
      :aria-label="$t('settings.title')"
      :aria-expanded="open"
      @click="toggle"
      @mouseenter="hoverSFX"
    >
      <img :src="svg('gear')" alt="" />
    </button>

    <Transition name="sm">
      <div v-if="open" class="sm-panel" role="menu">
        <h3>{{ $t('settings.title') }}</h3>
        <button class="sm-row" role="menuitemcheckbox" :aria-checked="Settings.music.enabled" @click="ui.toggleMusic()">
          <img :src="svg('music')" alt="" />
          <span>{{ $t('settings.musicLabel') }}</span>
          <i class="sm-switch" :class="{ on: Settings.music.enabled }"></i>
        </button>
        <button v-if="Settings.music.enabled && musicState.status !== 'playing'" class="sm-music-status" @click="music.retry()">
          {{ $t('settings.musicStatus.' + musicState.status) }}
        </button>
        <button class="sm-row" role="menuitemcheckbox" :aria-checked="Settings.soundEffects.enabled" @click="ui.toggleSFX()">
          <img :src="svg('sfx')" alt="" />
          <span>{{ $t('settings.sfxLabel') }}</span>
          <i class="sm-switch" :class="{ on: Settings.soundEffects.enabled }"></i>
        </button>
        <button
          class="sm-row"
          role="menuitemcheckbox"
          :aria-checked="Settings.notifications.enabled"
          @click="ui.toggleNotifications()"
        >
          <img :src="svg('notification')" alt="" />
          <span>{{ $t('settings.notificationsLabel') }}</span>
          <i class="sm-switch" :class="{ on: Settings.notifications.enabled }"></i>
        </button>

        <button
          v-if="fullscreen.supported"
          class="sm-row"
          role="menuitemcheckbox"
          :aria-checked="fullscreen.active"
          @click="toggleFullscreen()"
        >
          <img :src="svg('fullscreen')" alt="" />
          <span>{{ $t('settings.fullscreenLabel') }}</span>
          <i class="sm-switch" :class="{ on: fullscreen.active }"></i>
        </button>

        <h3>{{ $t('settings.controls') }}</h3>
        <dl class="sm-keys">
          <template v-for="k in touch.coarse ? touchKeys : keys" :key="k">
            <dt>{{ $t((touch.coarse ? 'controlsTouch.' : 'controls.') + k + '.key') }}</dt>
            <dd>{{ $t((touch.coarse ? 'controlsTouch.' : 'controls.') + k + '.action') }}</dd>
          </template>
        </dl>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { ui } from '../store'
import { music, musicState } from '../music'
import { Settings } from '../settings'
import { svgPath } from '../assets'
import { hoverSFX, AudioManager } from '../audio'
import { touch } from '../touch'
import { fullscreen, toggleFullscreen } from '../fullscreen'

const KEYS = ['inspect', 'pass', 'escape', 'carousel', 'factions']
const TOUCH_KEYS = ['hold', 'tap', 'swipe', 'outside', 'rotate']

export default defineComponent({
  name: 'SettingsMenu',
  setup() {
    const open = ref(false)
    const root = ref<HTMLElement | null>(null)
    const toggle = () => {
      open.value = !open.value
      AudioManager.playSFX(open.value ? 'open' : 'ui_card')
    }
    const onDocClick = (e: MouseEvent) => {
      if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
    }
    // Esc closes the menu first (before the game reacts to it)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open.value) {
        open.value = false
        e.stopImmediatePropagation()
      }
    }
    onMounted(() => {
      document.addEventListener('mousedown', onDocClick)
      window.addEventListener('keydown', onKey, true)
    })
    onBeforeUnmount(() => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey, true)
    })
    return { music, musicState, open, root, toggle, ui, Settings, svg: svgPath, hoverSFX, keys: KEYS, touchKeys: TOUCH_KEYS, touch, fullscreen, toggleFullscreen }
  },
})
</script>

<style>
.settings-menu {
  position: fixed;
  top: max(6px, 0.5vw);
  right: calc(max(8px, 0.6vw) + 2 * max(30px, 2.1vw) + max(6px, 0.4vw) + max(10px, 0.7vw));
  z-index: 2000;
  font-family: 'Arial Narrow', sans-serif;
}
.sm-gear {
  display: block;
  width: max(22px, 1.45vw);
  height: max(22px, 1.45vw);
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s, transform 0.4s;
}
.sm-gear img {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 2px #000);
}
.sm-gear:hover,
.settings-menu.open .sm-gear {
  opacity: 1;
}
.settings-menu.open .sm-gear {
  transform: rotate(60deg);
}
.sm-panel {
  position: absolute;
  top: calc(100% + max(8px, 0.5vw));
  right: 0;
  width: max(250px, 16vw);
  padding: max(10px, 0.7vw) max(12px, 0.8vw) max(12px, 0.8vw);
  color: tan;
  font-size: max(13px, 0.85vw);
  background: linear-gradient(rgba(30, 24, 15, 0.98), rgba(12, 10, 8, 0.98));
  border: 1px solid #6d5210;
  box-shadow: 0 0 1.2em rgba(109, 82, 16, 0.6), 0 0.6em 1.6em rgba(0, 0, 0, 0.8);
}
.sm-panel::before {
  content: '';
  position: absolute;
  top: -6px;
  right: max(6px, 0.4vw);
  width: 10px;
  height: 10px;
  background: #1e180f;
  border-left: 1px solid #6d5210;
  border-top: 1px solid #6d5210;
  transform: rotate(45deg);
}
.sm-panel h3 {
  margin: 0.2em 0 0.5em;
  font-size: 0.8em;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #9f7d3e;
}
.sm-panel h3:not(:first-child) {
  margin-top: 1em;
  padding-top: 0.8em;
  border-top: 1px solid rgba(109, 82, 16, 0.4);
}
.sm-row {
  display: flex;
  align-items: center;
  gap: 0.7em;
  width: 100%;
  padding: 0.45em 0.3em;
  font: inherit;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.sm-row:hover {
  background: rgba(218, 165, 32, 0.08);
  color: goldenrod;
}
.sm-row img {
  width: 1.4em;
  height: 1.4em;
}
.sm-row span {
  flex: 1;
}
.sm-switch {
  position: relative;
  width: 2.3em;
  height: 1.2em;
  border-radius: 1em;
  background: #2b241a;
  border: 1px solid #4a3b1a;
  transition: background 0.2s;
}
.sm-switch::after {
  content: '';
  position: absolute;
  top: 0.1em;
  left: 0.12em;
  width: 0.9em;
  height: 0.9em;
  border-radius: 50%;
  background: #7a6a55;
  transition: transform 0.2s, background 0.2s;
}
.sm-switch.on {
  background: #5a4515;
  border-color: goldenrod;
}
.sm-switch.on::after {
  transform: translateX(1.06em);
  background: goldenrod;
}
.sm-music-status {
  width: 100%;
  padding: 0.4em 0.7em;
  color: #d9bc80;
  border: 1px solid #6d5210;
  background: #211b10;
  font: inherit;
  cursor: pointer;
}
.sm-keys {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.35em 0.8em;
  margin: 0;
  font-size: 0.92em;
}
.sm-keys dt {
  color: #e8d3a4;
  white-space: nowrap;
}
.sm-keys dt::before,
.sm-keys dt::after {
  color: #6d5210;
}
.sm-keys dd {
  margin: 0;
  color: #ab977c;
}
.sm-enter-active,
.sm-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.sm-enter-from,
.sm-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
