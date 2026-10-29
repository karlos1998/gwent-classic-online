<template>
  <GameBoard @exit="game.exitGame()" />

  <DeckCustomization />

  <SettingsButtons />
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue'
import { ctx } from '@/engine'
import { initMusic } from '@/ui/store'
import { AudioManager } from '@/ui/audio'
import { ensureEngine } from '@/ui/bootstrap'
import GameBoard from '@/ui/components/GameBoard.vue'
import DeckCustomization from '@/ui/components/DeckCustomization.vue'
import SettingsButtons from '@/ui/components/SettingsButtons.vue'

export default defineComponent({
  name: 'OfflineGame',
  components: { GameBoard, DeckCustomization, SettingsButtons },
  setup() {
    ensureEngine()
    onMounted(() => {
      document.body.classList.add('gwent-board')
      initMusic()
      AudioManager.playSFX('menu_opening')
    })
    return { game: ctx.game }
  },
})
</script>
