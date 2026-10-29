<template>
  <!-- Top bar of the online lobby (over the deck builder): who am I, connection, leave -->
  <header class="lobby-bar">
    <RouterLink to="/" class="lb-back" :title="$t('online.back')" @mouseenter="hoverSFX">‹ {{ $t('online.back') }}</RouterLink>
    <PlayerCard v-if="online.profile" :profile="online.profile" size="sm" :show-stats="false" />
    <span class="lb-status" :class="online.socketState">
      <i></i>{{ $t('online.connection.' + online.socketState) }}
    </span>
    <button class="lb-logout" :disabled="!!online.search || !!online.match" @click="online.signOut()" @mouseenter="hoverSFX">
      {{ $t('online.lobby.changeNickname') }}
    </button>
  </header>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { online } from '../session'
import { hoverSFX } from '@/ui/audio'
import PlayerCard from './PlayerCard.vue'

export default defineComponent({
  name: 'LobbyBar',
  components: { PlayerCard },
  setup() {
    return { online, hoverSFX }
  },
})
</script>

<style>
.lobby-bar {
  position: absolute;
  top: 0.8vw;
  left: 1vw;
  z-index: 95;
  display: flex;
  align-items: center;
  gap: 1.2vw;
  padding: 0.45vw 1vw 0.45vw 0.7vw;
  font-size: 0.9vw;
  background: rgba(12, 10, 8, 0.9);
  border: 0.1vw solid #3a2e14;
  box-shadow: 0 0 0.8vw rgba(109, 82, 16, 0.55);
}
.lobby-bar .lb-back {
  color: #9f7d3e;
  text-decoration: none;
  white-space: nowrap;
}
.lobby-bar .lb-back:hover {
  color: goldenrod;
}
.lb-status {
  display: inline-flex;
  align-items: center;
  gap: 0.4vw;
  color: #8f8068;
  font-size: 0.8vw;
  white-space: nowrap;
}
.lb-status i {
  width: 0.55vw;
  height: 0.55vw;
  border-radius: 50%;
  background: #7a6a55;
}
.lb-status.open i {
  background: #5fbf6f;
  box-shadow: 0 0 0.5vw #5fbf6f;
}
.lb-status.connecting i,
.lb-status.reconnecting i {
  background: #e0a030;
  animation: lb-blink 0.9s infinite alternate;
}
.lb-status.closed i {
  background: #c0392b;
}
@keyframes lb-blink {
  to {
    opacity: 0.25;
  }
}
.lb-logout {
  font: inherit;
  font-size: 0.8vw;
  color: #ab977c;
  background: transparent;
  border: 0.08vw solid #4a3b1a;
  padding: 0.25vw 0.7vw;
  cursor: pointer;
}
.lb-logout:hover:not(:disabled) {
  color: goldenrod;
  border-color: #9f7d3e;
}
.lb-logout:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
