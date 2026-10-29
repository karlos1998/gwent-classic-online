<template>
  <section
    id="end-screen"
    :class="{ hide: s.hidden }"
    :style="s.opacity !== null ? { opacity: s.opacity } : {}"
  >
    <div :class="data ? 'end-' + data.result : ''"></div>
    <table>
      <colgroup>
        <col span="3" />
        <col span="1" />
        <col span="1" />
        <col span="1" />
      </colgroup>
      <tbody>
        <tr>
          <th colspan="2"></th>
          <th>Round 1</th>
          <th>Round 2</th>
          <th>Round 3</th>
        </tr>
        <tr>
          <th colspan="2">{{ data ? data.names[0] : 'Geralt' }}</th>
          <td v-for="(r, i) in rounds" :key="'me' + i" :style="{ color: r.meWon ? 'goldenrod' : '' }">{{ r.me }}</td>
        </tr>
        <tr>
          <th colspan="2">{{ data ? data.names[1] : 'Opponent' }}</th>
          <td v-for="(r, i) in rounds" :key="'op' + i" :style="{ color: r.opWon ? 'goldenrod' : '' }">{{ r.op }}</td>
        </tr>
      </tbody>
    </table>
    <p :class="{ hide: !data || data.result !== 'draw' }">
      The battle cannot end in a draw. You can play a rematch using the same decks or surrender.
    </p>
    <button @mouseenter="hoverSFX" @click="game.returnToCustomization()">Customize</button>
    <button @mouseenter="hoverSFX" @click="game.rematchGame()">Rematch</button>
    <button @mouseenter="hoverSFX" @click="game.newOpponentGame()">New Game</button>
  </section>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { ctx } from '@/engine'
import { ui } from '../store'
import { hoverSFX } from '../audio'

export default defineComponent({
  name: 'EndScreen',
  setup() {
    const s = ui.endScreen
    const data = computed(() => s.data)
    const rounds = computed(
      () => s.data?.rounds ?? [0, 1, 2].map(() => ({ me: 0, op: 0, meWon: false, opWon: false })),
    )
    return { s, data, rounds, game: ctx.game, hoverSFX }
  },
})
</script>
