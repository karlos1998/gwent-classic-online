<template>
  <section id="deck-customization" :class="{ hide: !ui.customizationVisible, locked }">
    <!-- faction tabs, as in The Witcher 3 (Q / E or click) -->
    <nav id="faction-tabs" :aria-label="$t('deck.factions')">
      <button class="ft-key" type="button" :title="$t('deck.prevFaction')" @click="shiftFaction(-1)" @mouseenter="hoverSFX">Q</button>
      <button
        v-for="f in FACTIONS"
        :key="f"
        type="button"
        class="ft-tab"
        :class="{ active: f === dm.faction }"
        :title="factionName(f)"
        :aria-pressed="f === dm.faction"
        @click="chooseFaction(f)"
        @mouseenter="hoverSFX"
      >
        <span :style="{ backgroundImage: icon('deck_shield_' + f) }"></span>
      </button>
      <button class="ft-key" type="button" :title="$t('deck.nextFaction')" @click="shiftFaction(1)" @mouseenter="hoverSFX">E</button>
    </nav>
    <div id="faction-title" class="center">
      <h1>{{ dm.factionName }}</h1>
    </div>
    <p id="faction-description">{{ dm.factionDescription }}</p>

    <label id="upload-deck" class="deck-options" @mouseenter="hoverSFX">
      <input type="file" id="add-file" style="display: none" @change="onUpload" />
      {{ $t('deck.uploadDeck') }}
    </label>

    <a id="download-deck" class="deck-options" @click="dm.downloadDeck()" @mouseenter="hoverSFX">{{ $t('deck.downloadDeck') }}</a>

    <h2 id="card-bank-title" class="card-contianer-title">{{ $t('deck.collection') }}</h2>
    <h2 id="card-deck-title" class="card-contianer-title">{{ $t('deck.inDeck') }}</h2>
    <div v-for="side in SIDES" :key="side" :id="'filters-' + side" class="card-filters" role="tablist">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        type="button"
        role="tab"
        :class="{ active: filters[side] === f.key }"
        :aria-selected="filters[side] === f.key"
        :title="$t('deck.filter.' + f.key)"
        @click="setFilter(side, f.key)"
        @mouseenter="hoverSFX"
      >
        <span :style="{ backgroundImage: icon(f.icon) }"></span>
      </button>
      <span class="cf-label">{{ $t('deck.filter.' + filters[side]) }}</span>
    </div>
    <div id="card-bank" class="card-array">
      <div
        v-for="(x, i) in dm.bank"
        :key="'b' + x.index"
        class="card-lg"
        :class="{ hide: !shown(x, 'bank') }"
        :style="{ backgroundImage: large(x.index) }"
        @click="dm.select(i, true)"
        @contextmenu.prevent.stop="inspectCardIndex(x.index)"
        @mouseenter="hoverSFX"
      >
        <div>{{ x.count }}</div>
      </div>
      <div v-if="bankFaux" class="card-lg empty"></div>
    </div>
    <div id="card-deck" class="card-array">
      <div
        v-for="(x, i) in dm.deck"
        :key="'d' + x.index"
        class="card-lg"
        :class="{ hide: !shown(x, 'deck') }"
        :style="{ backgroundImage: large(x.index) }"
        @click="dm.select(i, false)"
        @contextmenu.prevent.stop="inspectCardIndex(x.index)"
        @mouseenter="hoverSFX"
      >
        <div>{{ x.count }}</div>
      </div>
      <div v-if="deckFaux" class="card-lg empty"></div>
    </div>
    <div id="card-leader">
      <p>{{ $t('deck.leader') }}</p>
      <div
        :style="{ backgroundImage: leaderImg }"
        @click="dm.selectLeader()"
        @contextmenu.prevent.stop="dm.leader && inspectCardIndex(dm.leader.index)"
        @mouseenter="hoverSFX"
      ></div>
    </div>
    <div id="deck-stats">
      <p>{{ $t('deck.totalCards') }}</p>
      <p>{{ dm.stats.total }}</p>
      <p>{{ $t('deck.unitCards') }}</p>
      <p :style="{ color: dm.stats.units < 22 ? 'red' : '' }">{{ dm.stats.units + (dm.stats.units < 22 ? '/22' : '') }}</p>
      <p>{{ $t('deck.specialCards') }}</p>
      <p :style="{ color: dm.stats.special > 10 ? 'red' : '' }">{{ dm.stats.special + '/10' }}</p>
      <p>{{ $t('deck.strength') }}</p>
      <p>{{ dm.stats.strength }}</p>
      <p>{{ $t('deck.heroCards') }}</p>
      <p>{{ dm.stats.hero }}</p>
    </div>
    <button id="start-game" @click="onStart" @mouseenter="hoverSFX">{{ $t(online ? 'online.lobby.findOpponent' : 'deck.startGame') }}</button>
    <div v-if="!online" id="opponent-preview" class="center">
      <div>
        <p>{{ $t('deck.opponentsDeck') }}</p>
      </div>
      <div class="center">
        <button
          id="op-preview-open"
          :class="{ hide: !dm.hasCustomOpponent }"
          :data-title="$t('deck.viewOpponent')"
          @click="dm.viewOponentCards()"
          @mouseenter="hoverSFX"
        ></button>
        <div id="op-preview-faction" :class="{ hide: !dm.hasCustomOpponent }" :style="opShield"></div>
        <label id="op-preview-leader" for="add-opponent" :data-title="$t('deck.uploadOpponent')" @mouseenter="hoverSFX">
          <input type="file" id="add-opponent" style="display: none" @change="onUploadOpponent" />
          <p>{{ dm.customOpponentLeaderName }}</p>
        </label>
        <button
          id="op-preview-clear"
          :class="{ hide: !dm.hasCustomOpponent }"
          :data-title="$t('deck.clearOpponent')"
          @click="dm.clearOpponentDeck()"
          @mouseenter="hoverSFX"
        ></button>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, reactive } from 'vue'
import { card_dict } from '@/engine'
import { ui } from '../store'
import { useDeckMaker, type BankEntry } from '../deckMaker'
import { factionName } from '@/i18n'
import { inspectCardIndex } from '../inspect'
import { iconURL, largeURL } from '../assets'
import { hoverSFX, AudioManager } from '../audio'

const FACTIONS = ['realms', 'nilfgaard', 'monsters', 'scoiatael', 'skellige'] as const
const SIDES = ['bank', 'deck'] as const
type Side = (typeof SIDES)[number]

/** card filters of The Witcher 3 deck builder */
const FILTERS = [
  { key: 'all', icon: 'deck_stats_count' },
  { key: 'close', icon: 'card_row_close' },
  { key: 'ranged', icon: 'card_row_ranged' },
  { key: 'siege', icon: 'card_row_siege' },
  { key: 'hero', icon: 'deck_stats_hero' },
  { key: 'weather', icon: 'power_frost' },
  { key: 'special', icon: 'deck_stats_special' },
] as const
type FilterKey = (typeof FILTERS)[number]['key']

function matches(filter: FilterKey, index: number) {
  const c = card_dict[index]
  const unit = c.deck !== 'weather' && c.deck !== 'special'
  switch (filter) {
    case 'all':
      return true
    case 'close':
    case 'ranged':
      return unit && (c.row === filter || c.row === 'agile')
    case 'siege':
      return unit && c.row === 'siege'
    case 'hero':
      return c.ability.split(' ').includes('hero')
    case 'weather':
      return c.deck === 'weather'
    case 'special':
      return c.deck === 'special'
  }
}

export default defineComponent({
  name: 'DeckCustomization',
  props: {
    /** online lobby: the start button searches for an opponent, no custom AI opponent */
    online: { type: Boolean, default: false },
    /** deck cannot be edited (matchmaking in progress) */
    locked: { type: Boolean, default: false },
  },
  emits: ['start'],
  setup(props, { emit }) {
    const dm = useDeckMaker()
    const large = (index: number) => largeURL(card_dict[index].deck + '_' + card_dict[index].filename)
    const leaderImg = computed(() => (dm.leader ? largeURL(dm.leader.card.deck + '_' + dm.leader.card.filename) : ''))
    const filters = reactive<Record<Side, FilterKey>>({ bank: 'all', deck: 'all' })
    const shown = (x: BankEntry, side: Side) => x.count > 0 && matches(filters[side], x.index)
    const setFilter = (side: Side, key: FilterKey) => {
      if (filters[side] === key) return
      filters[side] = key
      AudioManager.playSFX('ui_card')
    }
    // empty card element to keep alignment when visible count % 3 == 2 (original updateFauxCard)
    const bankFaux = computed(() => dm.bank.filter((x) => shown(x, 'bank')).length % 3 === 2)
    const deckFaux = computed(() => dm.deck.filter((x) => shown(x, 'deck')).length % 3 === 2)

    const chooseFaction = (f: string) => {
      if (props.locked || f === dm.faction) return
      dm.loadFactionDeck(f)
      filters.bank = filters.deck = 'all'
      AudioManager.playSFX('ui_card_bank')
    }
    const shiftFaction = (step: number) => {
      const i = FACTIONS.indexOf(dm.faction as (typeof FACTIONS)[number])
      chooseFaction(FACTIONS[(i + step + FACTIONS.length) % FACTIONS.length])
    }
    // Q / E switch factions while the deck builder is the active screen
    const onKey = (e: KeyboardEvent) => {
      if (!ui.customizationVisible || ui.carouselCurr || ui.popupState.visible || e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return
      const key = e.key.toLowerCase()
      if (key === 'q') shiftFaction(-1)
      else if (key === 'e') shiftFaction(1)
    }
    onMounted(() => window.addEventListener('keydown', onKey))
    onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
    const icon = (name: string) => iconURL(name)
    const opShield = computed(() =>
      dm.hasCustomOpponent ? { backgroundImage: iconURL('deck_shield_' + (dm.opponentData as { faction: string }).faction) } : {},
    )
    const onUpload = (e: Event) => dm.uploadPlayerDeck(e.target as HTMLInputElement)
    const onUploadOpponent = (e: Event) => dm.uploadOpponentDeck(e.target as HTMLInputElement)
    const onStart = () => {
      if (!props.online) return dm.startNewGame()
      const warning = dm.validationWarning()
      if (warning) {
        AudioManager.playSFX('warning')
        return alert(warning)
      }
      emit('start', dm.toDeckDto())
    }
    return {
      ui, dm, large, leaderImg, bankFaux, deckFaux, opShield, onUpload, onUploadOpponent, onStart, hoverSFX,
      inspectCardIndex, FACTIONS, SIDES, FILTERS, filters, shown, setFilter, chooseFaction, shiftFaction, icon, factionName,
    }
  },
})
</script>

<style>
#deck-customization.locked {
  pointer-events: none;
  filter: saturate(0.45) brightness(0.7);
  transition: filter 0.3s;
}

/* ---- start button ---- */
#deck-customization #start-game {
  top: 84.5%;
  left: 50%;
  transform: translateX(-50%);
  width: auto;
  height: auto;
  min-width: 11vw;
  padding: 0.55vw 1.6vw;
  font-family: inherit;
  font-size: 1.1vw;
  font-weight: bold;
  letter-spacing: 0.08em;
  color: #f3e2b4;
  background: linear-gradient(#4a3812, #241a07);
  border: 0.1vw solid #b8892a;
  border-radius: 0.15vw;
  box-shadow: 0 0 0.8vw rgba(218, 165, 32, 0.25), inset 0 0 0.6vw rgba(0, 0, 0, 0.6);
  text-shadow: 0 0.08vw 0.1vw #000;
  cursor: pointer;
  transition: box-shadow 0.15s, filter 0.15s;
}
#deck-customization #start-game:hover {
  filter: brightness(1.15);
  box-shadow: 0 0 1.4vw rgba(218, 165, 32, 0.55), inset 0 0 0.6vw rgba(0, 0, 0, 0.5);
}

/* ---- faction tabs (the active shield replaces the shield next to the faction name) ---- */
#deck-customization #faction-title {
  top: 6.6%;
}
#deck-customization button:focus {
  outline: none;
}
#deck-customization button:focus-visible {
  outline: 0.1vw solid goldenrod;
}
#faction-tabs {
  position: absolute;
  top: 1.2%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.6vw;
  z-index: 1;
}
#faction-tabs button {
  font: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  padding: 0;
}
#faction-tabs .ft-tab {
  width: 2.7vw;
  height: 2.7vw;
  border-bottom: 0.15vw solid transparent;
  opacity: 0.45;
  filter: grayscale(0.7);
  transition: opacity 0.15s, filter 0.15s, transform 0.15s;
}
.ft-tab span {
  display: block;
  width: 100%;
  height: 100%;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
#faction-tabs .ft-tab:hover {
  opacity: 0.85;
  filter: none;
}
#faction-tabs .ft-tab.active {
  opacity: 1;
  filter: drop-shadow(0 0 0.5vw rgba(218, 165, 32, 0.6));
  border-bottom-color: goldenrod;
  transform: scale(1.12);
}
#faction-tabs .ft-key {
  width: 1.6vw;
  height: 1.6vw;
  font-size: 0.85vw;
  color: #c9a14a;
  border: 0.08vw solid #6d5210;
  border-radius: 0.2vw;
  background: rgba(20, 16, 10, 0.9);
}
#faction-tabs .ft-key:hover {
  color: goldenrod;
  box-shadow: 0 0 0.5vw #6d5210;
}
#deck-customization #upload-deck {
  left: 42.4%;
}
#deck-customization #download-deck {
  left: 51.2%;
}

/* ---- card filters above the collection / the deck ---- */
.card-filters {
  position: absolute;
  top: 18.1%;
  width: 34.4%;
  padding: 0 1.1vw;
  display: flex;
  align-items: center;
  gap: 0.3vw;
}
#filters-bank {
  left: 8.275%;
}
#filters-deck {
  left: 58.4%;
}
.card-filters button {
  width: 2.1vw;
  height: 2.1vw;
  padding: 0.25vw;
  cursor: pointer;
  background: rgba(20, 20, 20, 0.6);
  border: 0;
  border-bottom: 0.12vw solid transparent;
  opacity: 0.6;
  transition: opacity 0.15s, background 0.15s;
}
.card-filters button span {
  display: block;
  width: 100%;
  height: 100%;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.card-filters button:hover {
  opacity: 0.85;
}
.card-filters button.active {
  opacity: 1;
  border-bottom-color: goldenrod;
  background: rgba(109, 82, 16, 0.25);
}
.cf-label {
  margin-left: 0.6vw;
  font-size: 0.95vw;
  color: #8f8068;
}
</style>
