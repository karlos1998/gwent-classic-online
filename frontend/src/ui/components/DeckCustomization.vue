<template>
  <section id="deck-customization" :class="{ hide: !ui.customizationVisible, locked }">
    <div id="faction-title" class="center">
      <h1 :style="{ backgroundImage: shield }">{{ dm.factionName }}</h1>
    </div>
    <p id="faction-description">{{ dm.factionDescription }}</p>

    <label id="upload-deck" class="deck-options" @mouseenter="hoverSFX">
      <input type="file" id="add-file" style="display: none" @change="onUpload" />
      {{ $t('deck.uploadDeck') }}
    </label>

    <a id="change-faction" class="deck-options" @click="dm.selectFaction()" @mouseenter="hoverSFX">{{ $t('deck.changeFaction') }}</a>

    <a id="download-deck" class="deck-options" @click="dm.downloadDeck()" @mouseenter="hoverSFX">{{ $t('deck.downloadDeck') }}</a>

    <h2 id="card-bank-title" class="card-contianer-title">{{ $t('deck.collection') }}</h2>
    <h2 id="card-deck-title" class="card-contianer-title">{{ $t('deck.inDeck') }}</h2>
    <div id="card-bank" class="card-array">
      <div
        v-for="(x, i) in dm.bank"
        :key="'b' + x.index"
        class="card-lg"
        :class="{ hide: !x.count }"
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
        :class="{ hide: !x.count }"
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
    <button id="start-game" :class="{ online }" @click="onStart" @mouseenter="hoverSFX">{{ $t(online ? 'online.lobby.findOpponent' : 'deck.startGame') }}</button>
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
import { computed, defineComponent } from 'vue'
import { card_dict } from '@/engine'
import { ui } from '../store'
import { useDeckMaker } from '../deckMaker'
import { inspectCardIndex } from '../inspect'
import { iconURL, largeURL } from '../assets'
import { hoverSFX, AudioManager } from '../audio'

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
    const shield = computed(() => (dm.faction ? iconURL('deck_shield_' + dm.faction) : ''))
    const leaderImg = computed(() => (dm.leader ? largeURL(dm.leader.card.deck + '_' + dm.leader.card.filename) : ''))
    // empty card element to keep alignment when visible count % 3 == 2 (original updateFauxCard)
    const bankFaux = computed(() => dm.bank.filter((x) => x.count).length % 3 === 2)
    const deckFaux = computed(() => dm.deck.filter((x) => x.count).length % 3 === 2)
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
    return { ui, dm, large, shield, leaderImg, bankFaux, deckFaux, opShield, onUpload, onUploadOpponent, onStart, hoverSFX, inspectCardIndex }
  },
})
</script>

<style>
#deck-customization.locked {
  pointer-events: none;
  filter: saturate(0.45) brightness(0.7);
  transition: filter 0.3s;
}
</style>
