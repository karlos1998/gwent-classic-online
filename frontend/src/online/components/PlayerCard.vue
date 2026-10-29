<template>
  <!-- Public profile: guests get the default avatar and a "Guest" badge; accounts (planned Google sign-in)
       show their avatar, a fixed name and the number of games played. -->
  <div class="player-card" :class="[size, { account: isAccount }]">
    <div class="pc-avatar">
      <img :src="avatar" alt="" referrerpolicy="no-referrer" @error="onAvatarError" />
    </div>
    <div class="pc-info">
      <div class="pc-name" :title="profile.nickname">{{ profile.nickname }}</div>
      <div class="pc-meta">
        <span class="pc-badge">{{ $t(isAccount ? 'online.profile.account' : 'online.profile.guest') }}</span>
        <span v-if="showStats" class="pc-stat">
          {{ $t('online.profile.gamesPlayed') }}:
          <strong>{{ profile.gamesPlayed ?? $t('online.profile.noStats') }}</strong>
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, type PropType } from 'vue'
import type { PlayerProfile } from '../protocol'
import { svgPath } from '@/ui/assets'

export default defineComponent({
  name: 'PlayerCard',
  props: {
    profile: { type: Object as PropType<PlayerProfile>, required: true },
    size: { type: String as PropType<'sm' | 'lg'>, default: 'lg' },
    /** games played row (prepared for accounts, guests show a dash) */
    showStats: { type: Boolean, default: true },
  },
  setup(props) {
    const broken = ref(false)
    const isAccount = computed(() => props.profile.kind === 'ACCOUNT')
    // only https avatars from the account provider are used, everything else falls back to the default
    const avatar = computed(() =>
      !broken.value && props.profile.avatarUrl?.startsWith('https://') ? props.profile.avatarUrl : svgPath('avatar_guest'),
    )
    return { isAccount, avatar, onAvatarError: () => (broken.value = true) }
  },
})
</script>

<style>
.player-card {
  display: flex;
  align-items: center;
  gap: 0.9vw;
  min-width: 0;
  color: tan;
}
.player-card .pc-avatar {
  flex: 0 0 auto;
  width: 4.6vw;
  height: 4.6vw;
  border-radius: 50%;
  padding: 0.18vw;
  background: linear-gradient(160deg, #c9a14a, #4d3a12);
  box-shadow: 0 0 1vw rgba(109, 82, 16, 0.7);
}
.player-card .pc-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  background: #121010;
}
.player-card .pc-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35vw;
}
.player-card .pc-name {
  font-size: 1.55vw;
  font-weight: bold;
  color: goldenrod;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 0.1vw 0.1vw #000;
}
.player-card .pc-meta {
  display: flex;
  align-items: center;
  gap: 0.7vw;
  font-size: 0.85vw;
  color: #ab977c;
}
.player-card .pc-badge {
  padding: 0.12vw 0.55vw;
  border: 0.08vw solid #6d5210;
  color: #c9a14a;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72vw;
  background: rgba(109, 82, 16, 0.15);
}
.player-card.account .pc-badge {
  border-color: #3f7d4a;
  color: #8fd19e;
  background: rgba(63, 125, 74, 0.15);
}
.player-card .pc-stat strong {
  color: tan;
}
.player-card.sm {
  gap: 0.6vw;
}
.player-card.sm .pc-avatar {
  width: 2.6vw;
  height: 2.6vw;
  padding: 0.12vw;
}
.player-card.sm .pc-name {
  font-size: 1.05vw;
}
.player-card.sm .pc-meta {
  font-size: 0.7vw;
}
.player-card.sm .pc-badge {
  font-size: 0.6vw;
}
</style>
