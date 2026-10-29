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
          <th v-for="n in 3" :key="n">{{ $t('end.round', { n }) }}</th>
        </tr>
        <tr>
          <th colspan="2">{{ data ? data.names[0] || $t('game.player1') : $t('end.defaultMe') }}</th>
          <td v-for="(r, i) in rounds" :key="'me' + i" :style="{ color: r.meWon ? 'goldenrod' : '' }">{{ r.me }}</td>
        </tr>
        <tr>
          <th colspan="2">{{ data ? data.names[1] || $t('game.player2') : $t('end.defaultOp') }}</th>
          <td v-for="(r, i) in rounds" :key="'op' + i" :style="{ color: r.opWon ? 'goldenrod' : '' }">{{ r.op }}</td>
        </tr>
      </tbody>
    </table>
    <p :class="{ hide: !data || data.result !== 'draw' || !!data.actions }">
      {{ $t('end.drawMessage') }}
    </p>
    <p v-if="data?.message" class="end-message">{{ $t(data.message) }}</p>
    <template v-if="data?.actions">
      <button v-for="a in data.actions" :key="a.label" @mouseenter="hoverSFX" @click="a.run()">{{ $t(a.label) }}</button>
    </template>
    <template v-else>
      <button @mouseenter="hoverSFX" @click="game.returnToCustomization()">{{ $t('end.customize') }}</button>
      <button @mouseenter="hoverSFX" @click="game.rematchGame()">{{ $t('end.rematch') }}</button>
      <button @mouseenter="hoverSFX" @click="game.newOpponentGame()">{{ $t('end.newGame') }}</button>
    </template>
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

<style>
#end-screen > p.end-message {
  color: goldenrod;
}
</style>
