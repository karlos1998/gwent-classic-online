// Shared engine types. Kept framework-free so the same model can be mirrored by the
// Java/Spring backend later (online mode).

/** Raw card definition, exactly as in the original card_dict (all values are strings). */
export interface CardData {
  name: string
  id: string
  /** faction key: realms | nilfgaard | monsters | scoiatael | skellige | neutral | special | weather */
  deck: string
  /** close | ranged | siege | agile | leader | "" */
  row: string
  strength: string
  /** space separated ability keys, e.g. "hero muster" */
  ability: string
  filename: string
  count: string
  muster?: string
}

/** Card index in card_dict + how many copies. */
export interface IdCount {
  index: number
  count: number
}

/** Deck passed to a Player. */
export interface DeckData {
  faction: string
  leader: CardData
  cards: IdCount[]
}

/** Deck as stored / exported to JSON: {faction, leader: index, cards: [[index, count], ...]} */
export interface DeckJSON {
  faction: string
  leader: number
  cards: [number, number][]
}

export type Faction = 'realms' | 'nilfgaard' | 'monsters' | 'scoiatael' | 'skellige'

export type Effect = () => unknown | Promise<unknown>
