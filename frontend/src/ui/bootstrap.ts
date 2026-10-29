import { createEngine, ctx } from '@/engine'
import * as engine from '@/engine'
import { ui } from './store'
import { AudioManager } from './audio'

let created = false

/** Creates the engine singletons once (board, weather, game) and wires them to the Vue UI */
export function ensureEngine() {
  if (!created) {
    created = true
    AudioManager.init()
    createEngine(ui, AudioManager)
    // debug hook for automated UI tests / tinkering: open the game with ?debug
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search))
      (window as unknown as Record<string, unknown>).__gwent = { ctx, ui, engine }
  }
  return ctx
}
