<template>
  <GameStage>
    <GameBoard @exit="game.exitGame()" />
    <DeckCustomization />
  </GameStage>
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue'
import { ctx } from '@/engine'
import { AudioManager } from '@/ui/audio'
import { ensureEngine } from '@/ui/bootstrap'
import GameBoard from '@/ui/components/GameBoard.vue'
import DeckCustomization from '@/ui/components/DeckCustomization.vue'
import GameStage from '@/ui/components/GameStage.vue'

export default defineComponent({
  name: 'OfflineGame',
  components: { GameStage, GameBoard, DeckCustomization },
  setup() {
    ensureEngine()
    onMounted(() => {
      AudioManager.playSFX('menu_opening')
    })
    return { game: ctx.game }
  },
})
</script>
