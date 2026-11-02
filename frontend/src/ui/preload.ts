import { reactive } from 'vue'

const assets = __GWENT_PRELOAD_ASSETS__
const loaded = new Set<string>()
// Keep the prepared image objects alive through the game, including card previews.
const images = new Map<string, HTMLImageElement>()
let running: Promise<void> | undefined
export const assetLoading = reactive({ ready: false, completed: 0, total: assets.length, failed: 0, running: false })

async function prepare(url: string) {
  if (/\.(mp3|ogg|wav)$/i.test(url)) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) throw new Error(url)
    await response.arrayBuffer()
    return
  }
  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    let settled = false
    const timer = setTimeout(() => finish(new Error(url)), 30_000)
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      image.onload = image.onerror = null
      if (error) reject(error)
      else { images.set(url, image); resolve() }
    }
    image.onload = () => image.decode().then(() => finish(), finish)
    image.onerror = () => finish(new Error(url))
    image.src = url
  })
}

/** Bounded parallel downloads; retries keep successes and only reload failed files. */
export function preloadAssets(): Promise<void> {
  if (running) return running
  assetLoading.running = true
  assetLoading.failed = 0
  const pending = assets.filter((url) => !loaded.has(url))
  running = (async () => {
    await Promise.all(Array.from({ length: Math.min(8, pending.length) }, async () => {
      for (let url = pending.shift(); url; url = pending.shift()) {
        try {
          await prepare(url)
          loaded.add(url)
          assetLoading.completed = loaded.size
        } catch {
          assetLoading.failed++
        }
      }
    }))
    assetLoading.ready = loaded.size === assets.length
  })().finally(() => {
    assetLoading.running = false
    running = undefined
  })
  return running
}
