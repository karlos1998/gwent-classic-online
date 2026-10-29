<template>
  <div
    :id="'leader-' + tag"
    class="leader-box"
    :class="{ noclick: tag === 'me' && ui.leaderMeNoclick }"
    @click="ui.clickLeader(tag === 'me')"
    @mouseenter="player && hoverSFX()"
  >
    <div class="leader-container center" :class="{ fade: player?.leaderFaded }" :data-title="title">
      <CardView v-if="player" :key="player.leader.uid" :card="player.leader" />
    </div>
    <div class="leader-active" :class="{ hide: player && !player.leaderActiveShown }">
      <div></div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import type { Player } from '@/engine'
import CardView from './CardView.vue'
import { ui } from '../store'
import { hoverSFX } from '../audio'

export default defineComponent({
  name: 'LeaderBox',
  components: { CardView },
  props: {
    tag: { type: String as PropType<'me' | 'op'>, required: true },
    player: { type: Object as PropType<Player | null>, default: null },
  },
  setup(props) {
    const title = computed(() => (props.tag === 'me' && props.player?.leaderPlayable ? 'Play leader' : 'View leader'))
    return { ui, title, hoverSFX }
  },
})
</script>
