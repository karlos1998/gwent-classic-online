<template>
  <NicknameForm v-if="online.phase === 'nickname'" />

  <div v-else-if="online.phase === 'connecting'" class="home">
    <div class="home-bg"></div>
    <div class="home-content">
      <div class="sp-spinner online-connecting"><span></span><span></span><span></span></div>
      <p class="home-sub">{{ $t('online.connection.connecting') }}</p>
    </div>
  </div>

  <div v-else-if="online.phase === 'replaced'" class="home">
    <div class="home-bg"></div>
    <div class="home-content">
      <h1 class="home-title">{{ $t('online.replaced.title') }}</h1>
      <p class="home-sub">{{ $t('online.replaced.description') }}</p>
      <button class="nick-submit" @click="online.reclaim()">{{ $t('online.replaced.reclaim') }}</button>
      <p></p>
      <RouterLink to="/" class="mode back">{{ $t('online.back') }}</RouterLink>
    </div>
  </div>

  <template v-else>
    <GameStage>
      <!-- lobby: the deck builder of the offline mode, the start button searches for an opponent -->
      <template v-if="online.phase === 'lobby'">
        <DeckCustomization online :locked="!!online.search || !!online.match" @start="online.findMatch($event)" />
        <!-- leader selection of the deck builder -->
        <CarouselView />
        <PopupView />
        <LobbyBar />
        <SearchPanel v-if="online.search" />
      </template>

      <template v-else-if="online.game">
        <GameBoard @exit="confirmSurrender" />
        <TurnTimer :timer="online.game.view.timer" />
        <OpponentAway
          v-if="online.game.view.opponentAway"
          :ends-at="online.game.view.opponentAway.endsAt"
          :name="online.opponent?.nickname ?? ''"
        />
        <div v-if="online.socketState === 'reconnecting'" class="opponent-away reconnecting">
          <span class="oa-dot"></span>{{ $t('online.connection.reconnecting') }}
        </div>
      </template>
    </GameStage>
    <MatchFoundDialog v-if="online.phase === 'lobby' && online.match" :match="online.match" />
  </template>

  <ToastStack />
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted } from 'vue'
import { online } from '@/online/session'
import { ui, initMusic } from '@/ui/store'
import { AudioManager } from '@/ui/audio'
import { ensureEngine } from '@/ui/bootstrap'
import GameBoard from '@/ui/components/GameBoard.vue'
import DeckCustomization from '@/ui/components/DeckCustomization.vue'
import GameStage from '@/ui/components/GameStage.vue'
import CarouselView from '@/ui/components/CarouselView.vue'
import PopupView from '@/ui/components/PopupView.vue'
import NicknameForm from '@/online/components/NicknameForm.vue'
import LobbyBar from '@/online/components/LobbyBar.vue'
import SearchPanel from '@/online/components/SearchPanel.vue'
import MatchFoundDialog from '@/online/components/MatchFoundDialog.vue'
import TurnTimer from '@/online/components/TurnTimer.vue'
import OpponentAway from '@/online/components/OpponentAway.vue'
import ToastStack from '@/online/components/ToastStack.vue'

export default defineComponent({
  name: 'OnlineView',
  components: {
    GameBoard,
    DeckCustomization,
    GameStage,
    CarouselView,
    PopupView,
    NicknameForm,
    LobbyBar,
    SearchPanel,
    MatchFoundDialog,
    TurnTimer,
    OpponentAway,
    ToastStack,
  },
  setup() {
    ensureEngine()

    const confirmSurrender = () => {
      AudioManager.playSFX('warning')
      ui.popup(
        'popup.resume',
        () => {},
        'game.surrender',
        () => online.game?.surrender(),
        'popup.surrenderTitle',
        'popup.surrenderDescription',
      )
    }

    onMounted(() => {
      initMusic()
      online.resume()
      // automated UI tests: /online?debug exposes the session next to window.__gwent
      if (/[?&]debug\b/.test(location.search)) (window as unknown as Record<string, unknown>).__gwentOnline = online
    })
    // leaving the screen keeps the session (reload / come back), a running game has a grace period
    onBeforeUnmount(() => online.suspend())

    return { online, confirmSurrender }
  },
})
</script>

<style>
.online-connecting {
  margin: 0 auto 1em;
  width: 48px;
  height: 48px;
}
.online-connecting span {
  border-width: 3px;
}
.online-connecting span:nth-child(2) {
  inset: 7px;
}
.online-connecting span:nth-child(3) {
  inset: 15px;
}
.opponent-away.reconnecting {
  top: 5vw;
  background: rgba(60, 44, 10, 0.92);
  border-color: #a07a2a;
}
.mode.back {
  display: inline-flex;
  justify-content: center;
  min-width: 160px;
  font-size: 1.2em;
  color: goldenrod;
}
</style>
