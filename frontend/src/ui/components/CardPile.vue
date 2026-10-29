<template>
  <!-- Grave: all discarded cards stacked with a tiny offset -->
  <div
    v-if="kind === 'grave'"
    :id="'grave-' + tag"
    :ref="registerContainer('grave-' + tag)"
    class="grave cardpile"
    data-title="View discards"
    @click="player && ui.viewCardsInContainer(player.grave)"
    @mouseenter="player && player.grave.cards.length && hoverSFX()"
  >
    <template v-if="player">
      <CardView v-for="(c, i) in player.grave.cards" :key="c.uid" :card="c" :left="pileOffset(i)" />
    </template>
  </div>

  <!-- Deck: one card back per card + counter -->
  <div v-else :id="'deck-' + tag" :ref="registerContainer('deck-' + tag)" class="cardpile">
    <template v-if="player">
      <div
        v-for="i in player.deck.cards.length"
        :key="i"
        class="deck-card"
        :style="{ backgroundImage: back, left: pileOffset(i - 1) }"
      ></div>
      <div class="deck-counter center" :style="{ left: pileOffset(player.deck.cards.length) }">
        {{ player.deck.cards.length }}
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import type { Player } from '@/engine'
import CardView from './CardView.vue'
import { ui } from '../store'
import { registerContainer } from '../dom'
import { pileOffset } from '../layout'
import { iconURL } from '../assets'
import { hoverSFX } from '../audio'

export default defineComponent({
  name: 'CardPile',
  components: { CardView },
  props: {
    kind: { type: String as PropType<'grave' | 'deck'>, required: true },
    tag: { type: String as PropType<'me' | 'op'>, required: true },
    player: { type: Object as PropType<Player | null>, default: null },
  },
  setup(props) {
    const back = computed(() => (props.player ? iconURL('deck_back_' + props.player.deck.faction, 'jpg') : ''))
    return { ui, registerContainer, pileOffset, back, hoverSFX }
  },
})
</script>
