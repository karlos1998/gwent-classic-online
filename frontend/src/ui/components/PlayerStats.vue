<template>
  <!-- Opponent and me have a different child order in the original markup (CSS depends on it) -->
  <section v-if="tag === 'op'" id="stats-op" class="stats" :class="{ 'current-turn': player?.isTurn }">
    <div class="profile-img">
      <div><div :style="shield"></div></div>
    </div>
    <div id="name-op" class="name">{{ player ? player.name : 'Opponent' }}</div>
    <div id="deck-name-op" class="deck-name">{{ player?.deckName }}</div>
    <div id="hand-count-op" class="hand-count">{{ player ? player.hand.cards.length : 6 }}</div>
    <div id="gem1-op" class="gem bg-contain" :class="{ 'gem-on': health >= 1 }"></div>
    <div id="gem2-op" class="gem bg-contain" :class="{ 'gem-on': health >= 2 }"></div>
    <div id="score-total-op" class="score-total" :class="{ 'score-leader': player?.winning }">
      <div class="center">{{ player ? player.total : 0 }}</div>
    </div>
    <div id="passed-op" :class="{ passed: player?.passed }">Passed</div>
  </section>

  <section v-else id="stats-me" class="stats" :class="{ 'current-turn': player?.isTurn }">
    <div class="profile-img">
      <div><div :style="shield"></div></div>
    </div>
    <div id="passed-me" :class="{ passed: player?.passed }">Passed</div>
    <div id="hand-count-me" class="hand-count">{{ player ? player.hand.cards.length : 5 }}</div>
    <div id="gem1-me" class="gem bg-contain" :class="{ 'gem-on': health >= 1 }"></div>
    <div id="gem2-me" class="gem bg-contain" :class="{ 'gem-on': health >= 2 }"></div>
    <div id="name-me" class="name">{{ player?.name }}</div>
    <div id="deck-name-me" class="deck-name">{{ player?.deckName }}</div>
    <div id="score-total-me" class="score-total" :class="{ 'score-leader': player?.winning }">
      <div class="center">{{ player ? player.total : 0 }}</div>
    </div>
  </section>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import type { Player } from '@/engine'
import { iconURL } from '../assets'

export default defineComponent({
  name: 'PlayerStats',
  props: {
    tag: { type: String as PropType<'me' | 'op'>, required: true },
    player: { type: Object as PropType<Player | null>, default: null },
  },
  setup(props) {
    const health = computed(() => (props.player ? props.player.health : 2))
    const shield = computed(() =>
      props.player ? { backgroundImage: iconURL('deck_shield_' + props.player.deck.faction) } : {},
    )
    return { health, shield }
  },
})
</script>
