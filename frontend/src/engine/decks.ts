import { card_dict } from './data/cards'
import { premade_deck } from './data/decks'
import type { DeckData, IdCount } from './types'
import { isEmpty, randomInt } from './util'

export interface CustomOpponent {
  faction: string
  leader: number
  cards: IdCount[]
}

/** Builds the AI deck: a random premade deck (random leader of that faction) or the uploaded custom one */
export function constructOpponentDeck(custom: CustomOpponent | null | Record<string, never>, useCustom = true): DeckData {
  if (!useCustom || isEmpty(custom)) {
    const parsed = JSON.parse(premade_deck[randomInt(Object.keys(premade_deck).length)])
    const cards: IdCount[] = parsed.cards.map((c: [number, number]) => ({ index: c[0], count: c[1] }))
    const leaders = card_dict.filter((c) => c.row === 'leader' && c.deck === parsed.faction)
    return { faction: parsed.faction, cards, leader: leaders[randomInt(leaders.length)] }
  }
  const c = custom as CustomOpponent
  const leader = card_dict[c.leader]
  return { cards: c.cards, leader, faction: leader.deck }
}
