<template>
  <div class="home">
    <div class="home-bg"></div>
    <div class="home-content">
      <p class="home-kicker">{{ $t('home.kicker') }}</p>
      <h1 class="home-title">{{ $t('home.title') }}</h1>
      <p class="home-sub">{{ $t('home.subtitle') }}</p>

      <div class="home-modes">
        <RouterLink to="/offline" class="mode" @mouseenter="hoverSFX">
          <span class="mode-icon" :style="{ backgroundImage: icon('deck_shield_realms') }"></span>
          <span class="mode-text">
            <span class="mode-name">{{ $t('home.vsAi') }}</span>
            <span class="mode-desc">{{ $t('home.vsAiDesc') }}</span>
          </span>
        </RouterLink>

        <RouterLink to="/online" class="mode" @mouseenter="hoverSFX">
          <span class="mode-icon" :style="{ backgroundImage: icon('deck_shield_nilfgaard') }"></span>
          <span class="mode-text">
            <span class="mode-name">{{ $t('home.online') }} <em>{{ $t('home.soon') }}</em></span>
            <span class="mode-desc">{{ $t('home.onlineDesc') }}</span>
          </span>
        </RouterLink>
      </div>

      <p class="home-credit">
        {{ $t('home.creditBefore') }}
        <a href="https://github.com/asundr/gwent-classic" target="_blank" rel="noopener">{{ $t('home.creditLink') }}</a>
        {{ $t('home.creditAfter') }}
      </p>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { iconURL } from '@/ui/assets'
import { hoverSFX } from '@/ui/audio'

export default defineComponent({
  name: 'HomeView',
  setup() {
    return { icon: (n: string) => iconURL(n), hoverSFX }
  },
})
</script>

<style>
.home {
  position: fixed;
  inset: 0;
  font-size: 16px;
  font-family: 'Arial Narrow', sans-serif;
  color: tan;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}
.home-bg {
  position: absolute;
  inset: 0;
  background: url('/img/board.jpg') center / cover no-repeat;
  filter: blur(6px) brightness(0.35);
  transform: scale(1.05);
}
.home-content {
  position: relative;
  width: min(92vw, 760px);
  text-align: center;
  padding: 32px 16px;
}
.home-kicker {
  margin: 0;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  font-size: 0.85em;
  color: #9f7d3e;
}
.home-title {
  margin: 0.15em 0 0.1em;
  font-size: clamp(2.6em, 8vw, 4.6em);
  color: goldenrod;
  text-shadow: 0 0 24px rgba(218, 165, 32, 0.35), 0 2px 2px #000;
  font-weight: bold;
}
.home-sub {
  margin: 0 0 2em;
  color: #ab977c;
  font-size: 1.1em;
}
.home-modes {
  display: grid;
  gap: 16px;
}
.mode {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px 22px;
  text-align: left;
  text-decoration: none;
  color: inherit;
  background-color: rgba(20, 20, 20, 0.85);
  border: 0.15em solid #1d180b;
  box-shadow: 0 0 0.6em #6d5210;
  transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
}
.mode:hover {
  box-shadow: 0 0 1.8em #6d5210;
  border-color: #6d5210;
  transform: translateY(-1px);
}
.mode-icon {
  flex: 0 0 64px;
  height: 64px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.mode-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mode-name {
  font-size: 1.6em;
  font-weight: bold;
  color: goldenrod;
}
.mode-name em {
  font-style: normal;
  font-size: 0.5em;
  vertical-align: middle;
  margin-left: 0.5em;
  padding: 0.15em 0.5em;
  border: 1px solid #6d5210;
  color: #9f7d3e;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.mode-desc {
  color: #ab977c;
  font-size: 1em;
}
.home-credit {
  margin-top: 2.5em;
  font-size: 0.8em;
  color: #82735f;
}
.home-credit a {
  color: #9f7d3e;
}
</style>
