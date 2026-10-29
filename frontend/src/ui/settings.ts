// Persistent settings - ported from the original ToggleOption / SavedObject / SavedDeck / Settings.
// Everything is wrapped in try/catch because localStorage can be unavailable (private mode etc.).
import { reactive } from 'vue'
import { premade_deck } from '@/engine'
import type { IdCount } from '@/engine'

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}
function lsRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export class ToggleOption {
  key: string
  enabled: boolean
  action: (enabled: boolean) => void

  constructor(key: string, enableByDefault = true, action: (e: boolean) => void = () => {}) {
    this.key = key
    const saved = lsGet(this.key)
    this.enabled = saved !== null && saved !== undefined ? saved === 'true' : enableByDefault
    this.action = action
    return reactive(this) as ToggleOption
  }
  isEnabled() {
    return this.enabled
  }
  setEnabled(enable: boolean) {
    if (this.enabled === enable) return
    this.enabled = enable
    lsSet(this.key, String(this.enabled))
    this.action(this.enabled)
  }
  enable() {
    this.setEnabled(true)
  }
  disable() {
    this.setEnabled(false)
  }
  toggle() {
    this.setEnabled(!this.enabled)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>

export class SavedObject {
  key: string
  obj: Obj

  constructor(key: string, defaultValue: Obj | string = {}) {
    this.key = key
    const saved = lsGet(this.key)
    if (typeof defaultValue === 'string') defaultValue = JSON.parse(defaultValue)
    let parsed: Obj | null = null
    try {
      parsed = saved !== null && saved !== undefined ? JSON.parse(saved) : null
    } catch {
      parsed = null
    }
    this.obj = parsed ?? (defaultValue as Obj)
  }
  get(): Obj {
    return this.obj
  }
  set(newObj: Obj | null | undefined) {
    if (!this.key) return
    if (newObj === null || newObj === undefined) newObj = {}
    this.obj = newObj
    lsSet(this.key, JSON.stringify(newObj))
  }
  clear() {
    this.obj = {}
    lsRemove(this.key)
  }
}

export interface SavedDeckValue {
  faction?: string
  leader?: number
  cards?: IdCount[]
}

export class SavedDeck extends SavedObject {
  override get(): SavedDeckValue {
    const temp_deck = { ...super.get() }
    if (temp_deck.cards) temp_deck.cards = temp_deck.cards.map((c: [number, number]) => ({ index: c[0], count: c[1] }))
    return temp_deck
  }
  override set(newObj: SavedDeckValue) {
    const temp_deck: Obj = { ...newObj }
    temp_deck.cards = (newObj.cards ?? []).map((c) => [c.index, c.count])
    super.set(temp_deck)
  }
  setCards(cards: IdCount[]) {
    const deck = super.get()
    deck.cards = cards.map((c) => [c.index, c.count])
    super.set(deck)
  }
  setLeader(leader: { index: number }) {
    const deck = super.get()
    deck.leader = leader.index
    super.set(deck)
  }
}

export class SavedString {
  key: string
  value: string

  constructor(key: string, defaultValue = '') {
    this.key = key
    let saved = lsGet(this.key)
    if (saved === null || saved === undefined) saved = defaultValue
    this.value = saved
  }
  get() {
    return this.value
  }
  set(newValue: string) {
    if (this.value === newValue) return
    this.value = newValue
    lsSet(this.key, newValue)
  }
}

export const Settings = {
  music: new ToggleOption('gc-music', true),
  notifications: new ToggleOption('gc-notifications', true),
  soundEffects: new ToggleOption('gc-sound-effects', true),
  lastFaction: new SavedString('gc-last-faction', 'realms'),
  realmsDeck: new SavedDeck('gc-deck-realms', premade_deck[0]),
  nilfgaardDeck: new SavedDeck('gc-deck-nilfgaard', premade_deck[2]),
  monstersDeck: new SavedDeck('gc-deck-monsters', premade_deck[4]),
  scoiataelDeck: new SavedDeck('gc-deck-scoiatael', premade_deck[6]),
  skelligesDeck: new SavedDeck('gc-deck-skellige', premade_deck[8]),
  opponentDeckCustom: new SavedDeck('gc-deck-opponent-custom'),

  getFactionSettings(factionName: string): SavedDeck | null {
    switch (factionName) {
      case 'realms':
        return Settings.realmsDeck
      case 'nilfgaard':
        return Settings.nilfgaardDeck
      case 'monsters':
        return Settings.monstersDeck
      case 'scoiatael':
        return Settings.scoiataelDeck
      case 'skellige':
        return Settings.skelligesDeck
    }
    return null
  },
}
