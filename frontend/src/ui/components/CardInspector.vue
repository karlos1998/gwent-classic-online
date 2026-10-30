<template>
  <!-- Right-click preview of any card (deck builder, hand, board, discard piles, leaders) -->
  <Transition name="inspector">
    <div v-if="card" class="card-inspector" @click="close" @contextmenu.prevent.stop="close">
      <div class="ci-content">
        <div class="ci-card" :style="{ backgroundImage: image }"></div>
        <div class="ci-side">
          <h2 class="ci-name">{{ title }}</h2>
          <p v-if="meta" class="ci-meta">{{ meta }}</p>
          <div v-if="!desc.hidden && (desc.title || desc.text)" class="ci-ability">
            <div class="ci-ability-head">
              <span v-if="desc.icon" class="ci-icon" :style="{ backgroundImage: desc.icon }"></span>
              <h3>{{ desc.title }}</h3>
            </div>
            <p>{{ desc.text }}</p>
          </div>
          <p class="ci-hint">{{ $t('inspect.close') }}</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted } from 'vue'
import { describe } from '../store'
import { inspector, closeInspector } from '../inspect'
import { largeURL } from '../assets'
import { cardName, factionName, t } from '@/i18n'

export default defineComponent({
  name: 'CardInspector',
  setup() {
    const card = computed(() => inspector.card)
    const image = computed(() => (card.value ? largeURL(card.value.faction + '_' + card.value.filename) : ''))
    const title = computed(() => {
      const c = card.value
      if (!c) return ''
      return c.faction === 'faction' ? factionName(c.filename) : c.name ? cardName(c.name) : ''
    })
    // faction / row / strength line under the name
    const meta = computed(() => {
      const c = card.value
      if (!c || c.faction === 'faction') return ''
      const parts: string[] = []
      if (c.row === 'leader') parts.push(t('inspect.leader'))
      else if (c.faction === 'weather') parts.push(t('inspect.weather'))
      else if (c.faction === 'special') parts.push(t('inspect.special'))
      else {
        if (c.row) parts.push(t('inspect.row.' + c.row))
        if (c.basePower !== undefined) parts.push(t('inspect.strength', { n: c.basePower }))
        if (c.hero) parts.push(t('inspect.hero'))
      }
      if (['realms', 'nilfgaard', 'monsters', 'scoiatael', 'skellige'].includes(c.faction)) parts.push(factionName(c.faction))
      else if (c.faction === 'neutral') parts.push(t('inspect.neutral'))
      return parts.join(' · ')
    })
    const desc = computed(() => describe(card.value))
    const close = () => closeInspector()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspector.card) closeInspector()
    }
    onMounted(() => window.addEventListener('keydown', onKey))
    onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
    return { card, image, title, meta, desc, close }
  },
})
</script>

<style>
.card-inspector {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 5, 4, 0.9);
  cursor: pointer;
}
.ci-content {
  display: flex;
  align-items: center;
  gap: 2.4vw;
}
.ci-card {
  width: 18vw;
  height: 34vw;
  max-height: 88vh;
  max-width: calc(88vh * 18 / 34);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  filter: drop-shadow(0 0 1.6vw rgba(218, 165, 32, 0.35));
}
.ci-side {
  width: 30vw;
  display: flex;
  flex-direction: column;
  gap: 0.8vw;
}
.ci-name {
  margin: 0;
  font-size: 2vw;
  color: goldenrod;
  text-shadow: 0 0.1vw 0.2vw #000;
}
.ci-meta {
  margin: 0;
  font-size: 1vw;
  color: #ab977c;
}
.ci-ability {
  padding: 1vw 1.3vw 1.2vw;
  color: tan;
  background: rgba(20, 20, 20, 0.95);
  border: 0.1vw solid #ffffff57;
  border-width: 0.1vw 0;
}
.ci-ability-head {
  display: flex;
  align-items: center;
  gap: 0.8vw;
  margin-bottom: 0.6vw;
}
.ci-icon {
  flex: 0 0 auto;
  width: 2.2vw;
  height: 2.2vw;
  background-size: cover;
  background-position: center;
}
.ci-ability h3 {
  margin: 0;
  font-size: 1.25vw;
  color: goldenrod;
  text-transform: capitalize;
}
.ci-ability p {
  margin: 0;
  font-size: 1.02vw;
  line-height: 1.45;
}
.ci-hint {
  margin: 0.4vw 0 0;
  font-size: 0.8vw;
  color: #6f6150;
}
.inspector-enter-active,
.inspector-leave-active {
  transition: opacity 0.15s;
}
.inspector-enter-from,
.inspector-leave-to {
  opacity: 0;
}
</style>
