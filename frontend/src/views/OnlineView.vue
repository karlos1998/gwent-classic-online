<template>
  <div class="home">
    <div class="home-bg"></div>
    <div class="home-content">
      <p class="home-kicker">Coming soon</p>
      <h1 class="home-title">Play Online</h1>
      <p class="home-sub">The online mode will be powered by a Java / Spring Boot backend.</p>
      <ul class="online-list">
        <li>Sign in with Google (keeps your match history) or play as a guest with a nickname</li>
        <li>Quick match: random opponent from the matchmaking queue</li>
        <li>Invite a friend with a unique link, or challenge a player by nickname</li>
        <li>Server-authoritative rules, so nobody can cheat by editing the client</li>
      </ul>
      <RouterLink to="/" class="mode back">Back</RouterLink>
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
