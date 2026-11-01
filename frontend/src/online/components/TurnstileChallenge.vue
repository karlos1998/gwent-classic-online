<template>
  <div class="online-challenge">
    <div ref="container"></div>
    <p v-if="failed" role="alert">{{ $t('errors.captcha.unavailable') }}</p>
    <button v-if="failed" type="button" @click="start">{{ $t('online.challengeRetry') }}</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { api } from '../api'

import { loadTurnstile } from '../turnstile'

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
defineProps<{ modelValue: string }>()
const container = ref<HTMLElement | null>(null)
const failed = ref(false)
let widget: string | undefined
let disposed = false
let loading = false

function reset() {
  emit('update:modelValue', '')
  if (widget !== undefined) window.turnstile?.reset(widget)
}

async function start() {
  if (loading || disposed) return
  loading = true
  failed.value = false
  emit('update:modelValue', '')
  try {
    const [config, turnstile] = await Promise.all([api.challenge(), loadTurnstile()])
    if (disposed || !container.value) return
    if (widget !== undefined) turnstile.remove(widget)
    widget = turnstile.render(container.value, {
      sitekey: config.siteKey,
      action: 'online-entry',
      theme: 'dark',
      callback: (token: string) => { failed.value = false; emit('update:modelValue', token) },
      'expired-callback': () => emit('update:modelValue', ''),
      'error-callback': () => { failed.value = true; emit('update:modelValue', '') },
      'timeout-callback': () => { failed.value = true; emit('update:modelValue', '') },
    })
  } catch {
    if (!disposed) failed.value = true
  } finally {
    loading = false
  }
}

onMounted(start)
onBeforeUnmount(() => {
  disposed = true
  if (widget !== undefined) window.turnstile?.remove(widget)
})
defineExpose({ reset })
</script>

<style scoped>
.online-challenge { display: grid; justify-content: center; margin: 12px 0 18px; }
.online-challenge p { color: #e0664f; font-size: .85em; }
.online-challenge button { cursor: pointer; padding: 8px; }
</style>
