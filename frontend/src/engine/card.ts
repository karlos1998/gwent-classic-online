import { reactive } from 'vue'
import type { CardData, IdCount } from './types'
import type { Player } from './player'
import { ability_dict, type AbilityFn } from './abilities'
import { card_dict } from './data/cards'
import { ctx, playSFX } from './context'
import { fadeIn, fadeOut, sleep, type Fadeable } from './util'

let uidSeq = 0

export interface CardAnim extends Fadeable {
  /** anim_<name>.png overlay, '' when none */
  name: string
  size: string
}

// Contains information and behavior of a Card
export class Card {
  /** unique per instance - used as v-for key and for animations */
  readonly uid: number
  name: string
  basePower: number
  power: number
  faction: string
  abilities: string[]
  row: string
  filename: string
  muster?: string
  placed: AbilityFn[] = []
  removed: AbilityFn[] = []
  activated: AbilityFn[] = []
  holder: Player | null
  hero = false
  audio?: string
  desc_name: string
  desc: string
  noRemove?: boolean
  /** Extra data attached by the deck maker (leader picker) */
  data?: unknown

  // ---- presentation state (was DOM state on card.elem in the original) ----
  noclick = false
  /** >0 while a flight animation of this card is running (element is hidden in place) */
  flying = 0
  anim: CardAnim = { name: '', size: '', opacity: null, hidden: false }

  constructor(card_data: CardData, player: Player | null) {
    this.uid = ++uidSeq
    this.name = card_data.name
    this.basePower = this.power = Number(card_data.strength)
    this.faction = card_data.deck
    this.abilities = card_data.ability === '' ? [] : card_data.ability.split(' ')
    this.row = card_data.deck === 'weather' ? card_data.deck : card_data.row
    this.filename = card_data.filename
    if (card_data.muster) this.muster = card_data.muster
    this.holder = player

    if (this.abilities.length > 0) {
      this.audio = this.abilities[this.abilities.length - 1]
      if (this.abilities[0] === 'hero') {
        this.hero = true
        this.abilities.splice(0, 1)
      }
      for (const x of this.abilities) {
        const ab = ability_dict[x]
        if (ab.placed) this.placed.push(ab.placed)
        if (ab.removed) this.removed.push(ab.removed)
        if (ab.activated) this.activated.push(ab.activated)
      }
    }

    if (this.row === 'leader') this.desc_name = 'Leader Ability'
    else if (this.abilities.length > 0) this.desc_name = ability_dict[this.abilities[this.abilities.length - 1]].name ?? ''
    else if (this.row === 'agile') this.desc_name = 'agile'
    else if (this.hero) this.desc_name = 'hero'
    else this.desc_name = ''

    this.desc = this.row === 'agile' ? ability_dict['agile'].description! : ''
    for (let i = this.abilities.length - 1; i >= 0; --i) {
      this.desc += ability_dict[this.abilities[i]].description ?? ''
    }
    if (this.hero) this.desc += ability_dict['hero'].description

    // All engine objects are deeply reactive so the Vue UI re-renders on any change.
    return reactive(this) as Card
  }

  // Returns the identifier for this type of card
  id() {
    return this.name
  }

  // Sets the current power of this card
  setPower(n: number) {
    if (this.name === 'Decoy') return
    if (n !== this.power) this.power = n
  }

  // Resets the power of this card to default
  resetPower() {
    this.setPower(this.basePower)
  }

  // Automatically sends and translates this card to its appropriate row from the passed source
  async autoplay(source: import('./containers').CardContainer) {
    await ctx.board.toRow(this, source)
  }

  // Animates an ability effect
  async animate(name: string, bFade = true, bExpand = true) {
    playSFX(name)
    if (name === 'scorch') {
      return await this.scorch(name)
    }
    const anim = this.anim
    anim.name = name
    await sleep(50)

    if (bFade) fadeIn(anim, 300)
    if (bExpand) anim.size = '100% auto'
    await sleep(300)

    if (bExpand) anim.size = '80% auto'
    await sleep(1000)

    if (bFade) fadeOut(anim, 300)
    if (bExpand) anim.size = '40% auto'
    await sleep(300)

    anim.name = ''
  }

  // Animates the scorch effect
  async scorch(name: string) {
    const anim = this.anim
    anim.size = 'cover'
    anim.name = name
    await sleep(50)

    fadeIn(anim, 300)
    await sleep(1300)

    fadeOut(anim, 300)
    await sleep(300)

    anim.size = ''
    anim.name = ''
  }

  // Returns true if this is a combat card that is not a Hero
  isUnit() {
    return !this.hero && (this.row === 'close' || this.row === 'ranged' || this.row === 'siege' || this.row === 'agile')
  }

  // Returns true if card is sent to a Row's special slot
  isSpecial() {
    return this.name === "Commander's Horn" || this.name === 'Mardroeme'
  }

  isHero() {
    return this.hero
  }

  // Compares by type then power then name
  static compare(a: { faction: string; basePower: number; name: string }, b: { faction: string; basePower: number; name: string }) {
    let dif = factionRank(a) - factionRank(b)
    if (dif !== 0) return dif
    dif = a.basePower - b.basePower
    if (dif && dif !== 0) return dif
    return a.name.localeCompare(b.name)

    function factionRank(c: { faction: string }) {
      return c.faction === 'special' ? -2 : c.faction === 'weather' ? -1 : 0
    }
  }

  // Takes ID-Count object pairs and expands to a list of corresponding card data
  static expandIDCounts(card_id_list: IdCount[]): CardData[] {
    return card_id_list.reduce<CardData[]>((a, c) => a.concat(Array(Number(c.count)).fill(card_dict[c.index])), [])
  }

  // Takes ID-Count object pairs and returns a list of corresponding Cards
  static getCardsFromIdCounts(card_id_list: IdCount[], player: Player | null = null) {
    return Card.expandIDCounts(card_id_list).map((e) => new Card(e, player))
  }
}

/** Ability icon key shown on the card (original createCardElem / setDescription logic) */
export function abilityIconKey(card: { abilities: string[]; row: string; faction: string }): string {
  let str = card.row === 'agile' ? 'agile' : ''
  if (card.abilities.length) str = card.abilities[card.abilities.length - 1]
  if (str === 'cerys') str = 'muster'
  if (str.startsWith('avenger')) str = 'avenger'
  if (str === 'scorch_c' || str === 'scorch_r' || str === 'scorch_s') str = 'scorch'
  return str
}
