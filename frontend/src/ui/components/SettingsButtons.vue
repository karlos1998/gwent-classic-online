<template>
  <div
    :data-title="$t('settings.music')"
    id="toggle-music"
    class="center settings-button"
    :class="{ 'deck-menu': ui.deckMenu, fade: !ui.musicPlaying }"
    @click="ui.toggleMusic()"
    @mouseenter="hoverSFX"
  >
    <img :src="svg('music')" />
  </div>
  <div
    :data-title="$t('settings.sfx')"
    id="toggle-sfx"
    class="center settings-button"
    :class="{ 'deck-menu': ui.deckMenu, fade: !Settings.soundEffects.enabled }"
    @click="ui.toggleSFX()"
    @mouseenter="hoverSFX"
  >
    <img :src="svg('sfx')" />
  </div>
  <div
    :data-title="$t('settings.notifications')"
    id="toggle-notifications"
    class="center settings-button"
    :class="{ 'deck-menu': ui.deckMenu, fade: !Settings.notifications.enabled }"
    @click="ui.toggleNotifications()"
    @mouseenter="hoverSFX"
  >
    <img :src="svg('notification')" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ui } from '../store'
import { Settings } from '../settings'
import { svgPath } from '../assets'
import { hoverSFX } from '../audio'

export default defineComponent({
  name: 'SettingsButtons',
  setup() {
    return { ui, Settings, svg: svgPath, hoverSFX }
  },
})
</script>
