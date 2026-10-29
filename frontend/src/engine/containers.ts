import { reactive } from 'vue'
import { Card } from './card'
import type { Player } from './player'
import { card_dict } from './data/cards'
import { ctx, playSFX } from './context'
import { clamp, fadeIn, fadeOut, isNumber, randomInt, sleep, type Fadeable } from './util'
import type { IdCount } from './types'

export const DURATION_CARD_PLACEMENT = 1000

/** Selection highlighting flags (were CSS classes toggled by UI.setSelectable) */
export interface SelectFlags {
  selectable: boolean
  noclick: boolean
  specialSelectable: boolean
  specialNoclick: boolean
  cardSelectable: boolean
}

const newFlags = (): SelectFlags => ({
  selectable: false,
  noclick: false,
  specialSelectable: false,
  specialNoclick: false,
  cardSelectable: true,
})

// Handles the adding, removing and formatting of cards in a container
export class CardContainer {
  cards: Card[] = []
  /** DOM registry key, used by the UI for flight animations ('' = not rendered) */
  key: string

  constructor(key = '') {
    this.key = key
    return reactive(this) as this
  }

  // Returns the first card that satisfies the predicate. Does not modify container.
  findCard(predicate: (c: Card) => boolean): Card | undefined {
    for (let i = this.cards.length - 1; i >= 0; --i) if (predicate(this.cards[i])) return this.cards[i]
  }

  // Returns a list of cards that satisfy the predicate. Does not modify container.
  findCards(predicate: (c: Card) => boolean): Card[] {
    return this.cards.filter(predicate)
  }

  // Returns a list of up to n cards that satisfy the predicate. Does not modify container.
  findCardsRandom(predicate?: ((c: Card) => boolean) | null, n?: number): Card[] {
    const valid = predicate ? this.cards.filter(predicate) : this.cards
    if (valid.length === 0) return []
    if (!n || n === 1) return [valid[randomInt(valid.length)]]
    const out: Card[] = []
    for (let i = Math.min(n, valid.length); i > 0; --i) {
      const index = randomInt(valid.length)
      out.push(valid.splice(index, 1)[0])
    }
    return out
  }

  // Removes and returns a list of cards that satisfy the predicate.
  getCards(predicate: (c: Card, i: number) => boolean): Card[] {
    return this.cards
      .reduce<number[]>((a, c, i) => (predicate(c, i) ? [i] : ([] as number[])).concat(a), [])
      .map((i) => this.removeCard(i))
  }

  // Removes and returns a card that satisfies the predicate.
  getCard(predicate: (c: Card) => boolean): Card | undefined {
    for (let i = this.cards.length - 1; i >= 0; --i) if (predicate(this.cards[i])) return this.removeCard(i)
  }

  // Removes and returns any cards up to n that satisfy the predicate.
  getCardsRandom(predicate: (c: Card) => boolean, n: number): Card[] {
    return this.findCardsRandom(predicate, n).map((c) => this.removeCard(c))
  }

  // Adds a card to the container.
  addCard(card: Card, index?: number): unknown {
    if (!card) return
    index = index ? clamp(0, this.cards.length, index) : 0
    this.cards.splice(index, 0, card)
    this.resize()
  }

  // Removes a card from the container.
  removeCard(card: Card | number, index?: number): Card {
    if (this.cards.length === 0) throw 'Cannot draw from empty ' + this.constructor.name
    const removed = this.cards.splice(isNumber(card) ? card : this.cards.indexOf(card), 1)[0]
    this.removeCardElement(removed, index ? index : 0)
    this.resize()
    return removed
  }

  // Adds a card to a pre-sorted CardContainer
  addCardSorted(card: Card) {
    const i = this.getSortedIndex(card)
    this.cards.splice(i, 0, card)
    return i
  }

  // Returns the expected index of a card in a sorted CardContainer
  getSortedIndex(card: Card) {
    let i
    for (i = 0; i < this.cards.length; ++i) if (Card.compare(card, this.cards[i]) < 0) break
    return i
  }

  // Adds a card to a random index of the CardContainer
  addCardRandom(card: Card) {
    this.cards.push(card)
    const index = randomInt(this.cards.length)
    if (index !== this.cards.length - 1) {
      const t = this.cards[this.cards.length - 1]
      this.cards[this.cards.length - 1] = this.cards[index]
      this.cards[index] = t
    }
    return index
  }

  // Hook for subclasses (original removed the HTML element here)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeCardElement(_card: Card, _index: number) {}

  // Empty function to be overridden by subclasses that resize their content (layout is reactive now)
  resize() {}

  // Returns the container to its default, empty state
  reset() {
    while (this.cards.length) this.removeCard(0)
    this.cards = []
  }
}

// Contains all used cards in the order that they were discarded
export class Grave extends CardContainer {
  override addCard(card: Card) {
    super.addCard(card, this.cards.length)
  }

  override removeCard(card: Card | number): Card {
    const n = isNumber(card) ? card : this.cards.indexOf(card)
    return super.removeCard(card, n)
  }
}

// Contains a randomized set of cards to be drawn from
export class Deck extends CardContainer {
  faction: string

  constructor(faction: string, key: string) {
    super(key)
    this.faction = faction
  }

  // Creates duplicates of cards with a count of more than one, then initializes deck
  initializeFromID(card_id_list: IdCount[], player: Player) {
    this.initialize(Card.expandIDCounts(card_id_list), player)
  }

  // Populates this deck with a list of card data and associates those cards with the owner of this deck.
  initialize(card_data_list: import('./types').CardData[], player: Player) {
    for (let i = 0; i < card_data_list.length; ++i) {
      const card = new Card(card_data_list[i], player)
      this.addCardRandom(card)
    }
    this.resize()
  }

  override addCard(card: Card) {
    this.addCardRandom(card)
    this.resize()
  }

  // Sends the top card to the passed hand
  async draw(hand: CardContainer) {
    if (hand === ctx.op.hand) hand.addCard(this.removeCard(0))
    else await ctx.board.toHand(this.cards[0], this)
  }

  // Draws a card and sends it to the container before adding a card from the container back to the deck.
  // NOTE: Used only in mulligan and adds card out of order
  swap(container: CardContainer, card: Card) {
    if (!card) return
    const index = container.cards.indexOf(card)
    this.addCard(container.removeCard(card))
    const drawnCard = this.removeCard(0)
    container.addCard(drawnCard, index)
  }
}

// Hand used by computer AI. Rendered only as a counter + an offscreen anchor for card transitions.
export class HandAI extends CardContainer {}

// Hand used by current player (rendered sorted)
export class Hand extends CardContainer {
  override addCard(card: Card, index?: number) {
    if (!index) this.addCardSorted(card)
    else super.addCard(card, index)
    this.resize()
  }
}

export interface RowEffects {
  weather: boolean
  halfWeather: boolean
  bond: Record<string, number>
  morale: number
  horn: number
  mardroeme: number
}

const newEffects = (): RowEffects => ({ weather: false, halfWeather: false, bond: {}, morale: 0, horn: 0, mardroeme: 0 })

// Contains active cards and effects. Calculates the current score of each card and the row.
export class Row extends CardContainer {
  /** close | ranged | siege */
  type: string
  /** 0..5 board index (0-2 opponent siege/ranged/close, 3-5 me close/ranged/siege), -1 for virtual copies */
  index: number
  special: Card | null = null
  total = 0
  effects: RowEffects = newEffects()
  /** weather overlay visual state */
  overlay: Fadeable & { cls: string } = { cls: '', opacity: null, hidden: false }
  ui: SelectFlags = newFlags()

  constructor(type: string, index: number) {
    super(index >= 0 ? 'row-' + index : '')
    this.type = type
    this.index = index
  }

  // Returns a copy of the row
  getVirtualCopy(predicate: (c: Card) => boolean = () => true) {
    const copy = new Row(this.type, -1)
    copy.effects = { ...this.effects }
    copy.effects.bond = { ...this.effects.bond }
    copy.cards = this.cards.filter(predicate)
    // remove status of filtered out cards
    this.cards.filter((c) => !predicate(c)).forEach((c) => copy.updateState(c, false))
    return copy
  }

  override async addCard(card: Card) {
    if (card.isSpecial()) {
      this.special = card
    } else {
      this.addCardSorted(card)
      this.resize()
      await this.playPlacementAudio(card)
    }
    this.updateState(card, true)
    ctx.game.placedEffectsActive = true
    for (const x of card.placed) await x(card, this)
    ctx.game.placedEffectsActive = false
    card.noclick = true
    await sleep(600)
    this.updateScore()
  }

  async playPlacementAudio(card: Card) {
    let key: string | undefined
    if (card.abilities.includes('spy') || card.abilities.includes('vildkarrl')) return
    else if (card.abilities.includes('berserker') && this.effects.mardroeme >= 1) return
    else if (card.abilities.includes('decoy')) key = 'decoy'
    else if (card.isHero()) key = 'hero'
    else {
      switch (this.type) {
        case 'siege':
          key = 'common_siege'
          break
        case 'ranged':
          key = 'common_ranged'
          break
        case 'close':
          key = 'common_close'
          break
        default:
          return
      }
    }
    if (key) return await playSFX(key, DURATION_CARD_PLACEMENT, true)
  }

  override removeCard(card: Card | number): Card {
    const c = isNumber(card) ? (card === -1 ? this.special! : this.cards[card]) : card
    if (c.isSpecial()) {
      this.special = null
    } else {
      super.removeCard(c)
      c.resetPower()
    }
    this.updateState(c, false)
    for (const x of c.removed) x(c)
    this.updateScore()
    return c
  }

  override removeCardElement(card: Card) {
    card.noclick = false
  }

  // Updates a card's effect on the row
  updateState(card: Card, activate: boolean) {
    for (const x of card.abilities) {
      switch (x) {
        case 'morale':
        case 'horn':
        case 'mardroeme':
          this.effects[x] += activate ? 1 : -1
          break
        case 'bond':
          if (!this.effects.bond[card.id()]) this.effects.bond[card.id()] = 0
          this.effects.bond[card.id()] += activate ? 1 : -1
          break
      }
    }
  }

  // Activates weather effect and visuals
  addOverlay(overlay: string) {
    this.effects.weather = true
    this.overlay.cls = overlay
    fadeIn(this.overlay, 500)
    this.updateScore()
  }

  // Deactivates weather effect and visuals
  removeOverlay(overlay: string) {
    this.effects.weather = false
    fadeOut(this.overlay, 500).then(() => {
      if (this.overlay.cls === overlay) this.overlay.cls = ''
    })
    this.updateScore()
  }

  // Updates the row's score by summing the current power of its cards
  updateScore() {
    let total = 0
    for (const card of this.cards) total += this.cardScore(card)
    const player = this.index < 3 ? ctx.op : ctx.me
    player.updateTotal(total - this.total)
    this.total = total
  }

  // Calculates and sets the card's current power
  cardScore(card: Card) {
    const total = this.calcCardScore(card)
    card.setPower(total)
    return total
  }

  // Calculate total row score without updating
  calcScore() {
    return this.cards.reduce((sum, card) => sum + this.calcCardScore(card), 0)
  }

  // Calculates the current power of a card affected by row effects
  calcCardScore(card: Card) {
    if (card.name === 'decoy') return 0
    let total = card.basePower
    if (card.hero) return total
    if (this.effects.weather) {
      const weatherMin = this.effects.halfWeather ? Math.floor(total / 2) : 1
      total = Math.min(weatherMin, total)
    }
    if (ctx.game.doubleSpyPower && card.abilities.includes('spy')) total *= 2
    const bond = this.effects.bond[card.id()]
    if (isNumber(bond) && bond > 1) total *= Number(bond)
    total += Math.max(0, this.effects.morale + (card.abilities.includes('morale') ? -1 : 0))
    if (this.effects.horn - (card.abilities.includes('horn') ? 1 : 0) > 0) total *= 2
    return total
  }

  // Applies a temporary leader horn effect that is removed at the end of the round
  async leaderHorn() {
    if (this.special !== null) return
    const horn = new Card(card_dict[5], null)
    await this.addCard(horn)
    ctx.game.roundEnd.push(() => this.removeCard(horn))
  }

  // Applies a local scorch effect to this row
  async scorch() {
    if (this.total >= 10)
      await Promise.all(
        this.maxUnits().map(async (c) => {
          await c.animate('scorch', true, false)
          await ctx.board.toGrave(c, this)
        }),
      )
  }

  // Removes all cards and effects from this row
  async clear() {
    const toGrave = this.cards.filter((c) => !c.noRemove)
    if (this.special != null) toGrave.push(this.special)
    await Promise.all(toGrave.map(async (c) => await ctx.board.toGrave(c, this)))
  }

  // Returns all regular unit cards with the highest power
  maxUnits() {
    let max: Card[] = []
    for (let i = 0; i < this.cards.length; ++i) {
      const card = this.cards[i]
      if (!card.isUnit()) continue
      if (!max[0] || max[0].power < card.power) max = [card]
      else if (max[0].power === card.power) max.push(card)
    }
    return max
  }

  override reset() {
    super.reset()
    while (this.special) this.removeCard(this.special)
    this.total = 0
    this.effects = { weather: false, bond: {}, morale: 0, horn: 0, mardroeme: 0 } as RowEffects
    // (fix) the original left a stale weather overlay visible after quitting mid-game
    this.overlay.cls = ''
    this.overlay.opacity = null
    this.overlay.hidden = false
    this.ui = newFlags()
  }
}

export interface WeatherType {
  name: string
  count: number
  rows: Row[]
}

// Handles how weather effects are added and removed
export class Weather extends CardContainer {
  types: Record<'rain' | 'fog' | 'frost', WeatherType>
  ui: SelectFlags = newFlags()

  constructor(rows: Row[]) {
    super('weather')
    this.types = {
      rain: { name: 'rain', count: 0, rows: [] },
      fog: { name: 'fog', count: 0, rows: [] },
      frost: { name: 'frost', count: 0, rows: [] },
    }
    let i = 0
    for (const key of Object.keys(this.types) as ('rain' | 'fog' | 'frost')[]) {
      this.types[key].rows = [rows[i], rows[5 - i++]]
    }
  }

  // Adds a card if unique and clears all weather if 'clear weather' card added
  override async addCard(card: Card) {
    const isDuplicate = !!this.cards.find((c) => c.name === card.name)
    super.addCard(card)
    playSFX(card.audio)
    card.noclick = true
    if (card.name === 'Clear Weather') {
      // TODO Sunlight animation
      await sleep(500)
      this.clearWeather()
    } else {
      this.changeWeather(
        card,
        (x) => ++this.types[x].count === 1,
        (r, t) => r.addOverlay(t.name),
      )
      if (isDuplicate) {
        await sleep(750)
        await ctx.board.toGrave(card, this)
      }
    }
    await sleep(1000)
  }

  override removeCard(card: Card | number): Card {
    const c = super.removeCard(card)
    c.noclick = false
    this.changeWeather(
      c,
      (x) => --this.types[x].count === 0,
      (r, t) => r.removeOverlay(t.name),
    )
    return c
  }

  // Checks if a card's abilities are a weather type. If the predicate is met, perform the action
  // on the type's associated rows
  changeWeather(card: Card, predicate: (x: 'rain' | 'fog' | 'frost') => boolean, action: (r: Row, t: WeatherType) => void) {
    for (const x of card.abilities) {
      if (x in this.types && predicate(x as 'rain' | 'fog' | 'frost')) {
        for (const r of this.types[x as 'rain' | 'fog' | 'frost'].rows) action(r, this.types[x as 'rain' | 'fog' | 'frost'])
      }
    }
  }

  // Removes all weather effects and cards
  async clearWeather() {
    await Promise.all(
      this.cards
        .map((_c, i) => this.cards[this.cards.length - i - 1])
        .map(async (c) => await ctx.board.toGrave(c, this)),
    )
  }

  override reset() {
    super.reset()
    ;(Object.keys(this.types) as ('rain' | 'fog' | 'frost')[]).map((t) => (this.types[t].count = 0))
    this.ui = newFlags()
  }
}
