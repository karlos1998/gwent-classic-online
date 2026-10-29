<template>
  <div class="home">
    <div class="home-bg"></div>
    <div class="home-content">
      <p class="home-kicker">{{ $t('online.kicker') }}</p>
      <h1 class="home-title">{{ $t('online.title') }}</h1>
      <p class="home-sub">{{ $t('online.subtitle') }}</p>
      <ul class="online-list">
        <li v-for="n in 4" :key="n">{{ $t('online.feature' + n) }}</li>
      </ul>
      <RouterLink to="/" class="mode back">{{ $t('online.back') }}</RouterLink>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
export default defineComponent({ name: 'OnlineView' })
</script>

<style>
.online-list {
  text-align: left;
  margin: 0 auto 2em;
  max-width: 560px;
  line-height: 1.6;
  color: #ab977c;
}
.mode.back {
  display: inline-flex;
  justify-content: center;
  min-width: 160px;
  font-size: 1.2em;
  color: goldenrod;
}
</style>
