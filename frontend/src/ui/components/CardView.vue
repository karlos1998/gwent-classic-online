<template>
  <!-- Same DOM structure as the original createCardElem(): power / row / ability / animation overlay -->
  <div
    :ref="ghost ? undefined : registerCard(card.uid)"
    class="card"
    :class="{ hero: card.hero, special: card.faction === 'special', noclick: card.noclick && !ghost }"
    :style="rootStyle"
    :data-title="cardName(card.name)"
    @click="onClick"
    @mouseenter="onEnter"
  >
    <template v-if="card.row !== 'leader'">
      <div :style="{ backgroundImage: powerBg }">
        <div v-if="isCombat" class="center" :style="{ color: powerColor }">{{ card.power }}</div>
      </div>
      <div :style="{ backgroundImage: rowBg }"></div>
      <div :style="{ backgroundImage: abilityBg }"></div>
      <div :class="{ hide: card.anim.hidden }" :style="animStyle"></div>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import type { Card } from '@/engine'
import { iconURL, smallURL } from '../assets'
import { registerCard } from '../dom'
import { hoverSFX } from '../audio'
import { cardName } from '@/i18n'

export default defineComponent({
  name: 'CardView',
  props: {
    card: { type: Object as PropType<Card>, required: true },
    /** horizontal margin computed by the parent container (original resizeCardContainer) */
    margin: { type: String, default: '' },
    /** horizontal offset used by stacked piles (original setCardOffset) */
    left: { type: String, default: '' },
    /** rendered as a flying copy (flight animation) */
    ghost: { type: Boolean, default: false },
  },
  emits: ['select'],
  setup(props, { emit }) {
    const isCombat = computed(() => ['close', 'ranged', 'siege', 'agile'].includes(props.card.row))

    const powerBg = computed(() => {
      const c = props.card
      let bg: string
      if (c.hero) bg = 'power_hero'
      else if (c.faction === 'weather') bg = 'power_' + c.abilities[0]
      else if (c.faction === 'special') bg = 'power_' + c.abilities[0]
      else bg = 'power_normal'
      return iconURL(bg)
    })

    const rowBg = computed(() => (isCombat.value ? iconURL('card_row_' + props.card.row) : ''))

    const abilityBg = computed(() => {
      const c = props.card
      if (c.faction !== 'special' && c.faction !== 'weather' && c.abilities.length > 0) {
        let str = c.abilities[c.abilities.length - 1]
        if (str === 'cerys') str = 'muster'
        if (str.startsWith('avenger')) str = 'avenger'
        if (str === 'scorch_c' || str == 'scorch_r' || str === 'scorch_s') str = 'scorch'
        return iconURL('card_ability_' + str)
      } else if (c.row === 'agile') return iconURL('card_ability_agile')
      return ''
    })

    const powerColor = computed(() => {
      const c = props.card
      if (c.name === 'Decoy') return ''
      return c.power > c.basePower ? 'goldenrod' : c.power < c.basePower ? 'red' : ''
    })

    const animStyle = computed(() => {
      const a = props.card.anim
      const s: Record<string, string> = {}
      if (a.name) s.backgroundImage = iconURL('anim_' + a.name)
      if (a.size) s.backgroundSize = a.size
      if (a.opacity !== null) s.opacity = String(a.opacity)
      return s
    })

    const rootStyle = computed(() => {
      const s: Record<string, string> = { backgroundImage: smallURL(props.card.faction + '_' + props.card.filename) }
      if (props.ghost) return s
      if (props.margin) s.marginLeft = s.marginRight = props.margin
      if (props.left) s.left = props.left
      if (props.card.flying > 0) {
        // the original collapsed the slot of the moving card (margin-right = -width)
        s.visibility = 'hidden'
        s.marginRight = '-4.45vw'
        s.marginLeft = '0'
      }
      return s
    })

    const onClick = () => {
      if (!props.ghost) emit('select', props.card)
    }
    const onEnter = () => {
      if (!props.ghost && props.card.row !== 'leader') hoverSFX()
    }

    return { isCombat, powerBg, rowBg, abilityBg, powerColor, animStyle, rootStyle, onClick, onEnter, registerCard, cardName }
  },
})
</script>
