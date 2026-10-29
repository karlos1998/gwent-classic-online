<template>
  <div class="toast-stack" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in online.toasts" :key="t.id" class="toast" :class="t.kind" @click="online.dismissToast(t.id)">
        {{ text(t.key) }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { online } from '../session'
import { t, te } from '@/i18n'

export default defineComponent({
  name: 'ToastStack',
  setup() {
    // unknown server codes fall back to a generic message instead of showing the raw key
    const text = (key: string) => (te(key) ? t(key) : t(key.startsWith('errors.') ? 'errors.unknown' : key))
    return { online, text }
  },
})
</script>

<style>
.toast-stack {
  position: fixed;
  bottom: 1.4vw;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5vw;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  cursor: pointer;
  max-width: 40vw;
  padding: 0.6vw 1.2vw;
  font-size: max(13px, 0.9vw);
  color: #e8d3a4;
  background: rgba(16, 13, 9, 0.95);
  border: 0.08vw solid #6d5210;
  box-shadow: 0 0.3vw 1vw rgba(0, 0, 0, 0.7);
}
.toast.error {
  color: #f0d2c4;
  border-color: #a0382a;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.6vw);
}
</style>
