import { reactive } from 'vue'
import { Settings } from './settings'

interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  destroy(): void
}
interface PlayerEvent { data: number }
interface PlayerOptions {
  videoId: string
  playerVars: Record<string, string | number>
  events: {
    onReady(): void
    onStateChange(event: PlayerEvent): void
    onAutoplayBlocked(): void
    onError(): void
  }
}
declare global {
  interface Window {
    YT?: { Player: new (id: string, opts: PlayerOptions) => YTPlayer }
    onYouTubeIframeAPIReady?: () => void
  }
}

// Playback state never changes the user's saved preference.
export const musicState = reactive({ status: 'loading' as 'loading' | 'playing' | 'paused' | 'blocked' | 'error' })
let player: YTPlayer | null = null
let ready = false
let installed = false
let timeout: ReturnType<typeof setTimeout> | undefined

function fail() {
  clearTimeout(timeout)
  musicState.status = 'error'
}
function createPlayer() {
  if (player || !window.YT?.Player) return
  player = new window.YT.Player('youtube', {
    videoId: 'UE9fPWy1_o4',
    playerVars: {
      autoplay: 0, controls: 0, loop: 1, playlist: 'UE9fPWy1_o4',
      rel: 0, playsinline: 1, origin: location.origin,
    },
    events: {
      onReady() {
        clearTimeout(timeout)
        ready = true
        musicState.status = 'paused'
        music.sync()
      },
      onStateChange({ data }) {
        if (data === 1) {
          if (!Settings.music.isEnabled()) player?.pauseVideo()
          else musicState.status = 'playing'
        } else if (data === 2 || data === 0) musicState.status = 'paused'
      },
      onAutoplayBlocked() { musicState.status = 'blocked' },
      onError: fail,
    },
  })
}
function load() {
  clearTimeout(timeout)
  musicState.status = 'loading'
  timeout = setTimeout(fail, 15_000)
  if (window.YT?.Player) return createPlayer()
  window.onYouTubeIframeAPIReady = createPlayer
  if (document.getElementById('yt-api')) return
  const script = document.createElement('script')
  script.id = 'yt-api'
  script.src = 'https://www.youtube.com/iframe_api'
  script.async = true
  script.onerror = fail
  document.head.appendChild(script)
}

export const music = {
  init() {
    if (installed) return
    installed = true
    load()
    // A blocked autoplay is retried inside a real user gesture, without timers.
    const unlock = (event: Event) => {
      if (event.isTrusted && Settings.music.isEnabled() && musicState.status !== 'playing' && musicState.status !== 'error') music.sync()
    }
    document.addEventListener('click', unlock)
    document.addEventListener('keydown', unlock)
  },
  sync() {
    if (!ready || !player) return
    if (Settings.music.isEnabled()) player.playVideo()
    else {
      player.pauseVideo()
      musicState.status = 'paused'
    }
  },
  retry() {
    if (musicState.status !== 'error') return music.sync()
    player?.destroy()
    player = null
    ready = false
    // destroy removes the iframe. Restore its mount inside the persistent host.
    const host = document.getElementById('music-host')!
    host.replaceChildren(Object.assign(document.createElement('div'), { id: 'youtube' }))
    document.getElementById('yt-api')?.remove()
    load()
  },
}
