// Shared clocks for countdowns (performance.now() based, immune to wall-clock changes)
import { onBeforeUnmount, onMounted, ref } from 'vue'

/** Reactive performance.now(), refreshed every {@code intervalMs} while the component is mounted */
export function useNow(intervalMs = 250) {
  const now = ref(performance.now())
  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => (timer = setInterval(() => (now.value = performance.now()), intervalMs)))
  onBeforeUnmount(() => timer && clearInterval(timer))
  return now
}

/** 75_300 ms -> "1:15" (never negative) */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m + ':' + String(s).padStart(2, '0')
}

/** Reactive Date.now() (for times that come from the server clock) */
export function useNowMs(intervalMs = 250) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null
  onMounted(() => (timer = setInterval(() => (now.value = Date.now()), intervalMs)))
  onBeforeUnmount(() => timer && clearInterval(timer))
  return now
}

/** elapsed time, rounded down: 59_900 ms -> "0:59" */
export function formatElapsed(ms: number) {
  return formatDuration(Math.floor(Math.max(0, ms) / 1000) * 1000)
}
