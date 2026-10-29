// Sound effects - ported from the original AudioManager
import { sleep } from '@/engine'
import { audioPath } from './assets'
import { Settings } from './settings'

let userInteracted = false
if (typeof document !== 'undefined') document.addEventListener('click', () => (userInteracted = true), { once: true })

const source: Record<string, HTMLAudioElement> = {}

const PRELOADED = [
  'turn_me', 'turn_op', 'ui_card', 'ui_card_bank', 'open', 'draw',
  'clear', 'fog', 'frost', 'rain',
  'horn', 'spy', 'medic', 'morale', 'scorch', 'bond', 'decoy', 'mardroeme',
  'hero', 'common_close', 'common_ranged', 'common_siege',
]

function getAudio(name: string) {
  return new Audio(audioPath(name))
}

function asyncAudio(audio: HTMLAudioElement): Promise<void> | undefined {
  if (!userInteracted || !audio) return
  return new Promise((r) => {
    // (fix) resolve on error / blocked autoplay too, otherwise the game would wait forever
    audio.onended = () => r()
    audio.onerror = () => r()
    audio.play()?.catch(() => r())
  })
}

export const AudioManager = {
  init() {
    PRELOADED.forEach((s) => (source[s] = getAudio(s)))
  },

  async play(key: string, waitTime = -1, forceWait = false): Promise<void> {
    const audio = source[key]
    if (audio) {
      const isPlaying = audio.currentTime > 0 && !audio.paused && !audio.ended
      if (isPlaying) {
        audio.pause()
        audio.currentTime = 0
      }
      if (waitTime === -1 || (!forceWait && waitTime >= audio.duration * 1000)) return await asyncAudio(audio)
      else {
        audio.play()?.catch(() => {})
        return await sleep(waitTime)
      }
    } else {
      return await asyncAudio(getAudio(key))
    }
  },

  async playSFX(key: string, waitTime = -1, forceWait = false): Promise<void> {
    if (Settings.soundEffects.isEnabled()) return await AudioManager.play(key, waitTime, forceWait)
  },
}

/** mouseenter sound used all over the UI */
export const hoverSFX = () => AudioManager.playSFX('ui_card')
