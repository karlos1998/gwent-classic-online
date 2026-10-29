// Card & leader abilities - ported 1:1 from the original abilities.js
import { Card } from './card'
import { CardContainer, Row, type Grave } from './containers'
import { card_dict } from './data/cards'
import { ctx, playSFX } from './context'
import { ControllerAI } from './ai'
import type { Player } from './player'
import { removeFrom } from './util'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AbilityFn = (card: Card, arg?: any) => any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WeightFn = (card: Card, ai: ControllerAI, max?: any, data?: any) => number

export interface Ability {
  name?: string
  description?: string
  audio?: string
  placed?: AbilityFn
  removed?: AbilityFn
  activated?: AbilityFn
  weight?: WeightFn
  gameStart?: () => unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  helper?: (card: Card) => any
}

const ai = (p: Player | null) => (p?.controller instanceof ControllerAI ? p.controller : null)

export const ability_dict: Record<string, Ability> = {
  clear: {
    name: 'Clear Weather',
    description: 'Removes all Weather Cards (Biting Frost, Impenetrable Fog and Torrential Rain) effects. ',
    audio: 'clear',
  },
  frost: {
    name: 'Biting Frost',
    description: 'Sets the strength of all Close Combat cards to 1 for both players. ',
    audio: 'cold',
  },
  fog: {
    name: 'Impenetrable Fog',
    description: 'Sets the strength of all Ranged Combat cards to 1 for both players. ',
    audio: 'fog',
  },
  rain: {
    name: 'Torrential Rain',
    description: 'Sets the strength of all Siege Combat cards to 1 for both players. ',
    audio: 'rain',
  },
  storm: {
    name: 'Skellige Storm',
    description: 'Reduces the Strength of all Range and Siege Units to 1. ',
    audio: 'rain',
  },
  hero: {
    name: 'hero',
    description: 'Not affected by any Special Cards or abilities. ',
  },
  decoy: {
    name: 'Decoy',
    audio: 'decoy',
    description: 'Swap with a card on the battlefield to return it to your hand. ',
  },
  horn: {
    name: "Commander's Horn",
    description: 'Doubles the strength of all unit cards in that row. Limited to 1 per row. ',
    audio: 'horn',
    placed: async (card) => {
      await card.animate('horn')
    },
  },
  mardroeme: {
    name: 'Mardroeme',
    description: 'Triggers transformation of all Berserker cards on the same row. ',
    placed: async (_card, row: Row) => {
      const berserkers = row.findCards((c) => c.abilities.includes('berserker'))
      await Promise.all(berserkers.map(async (c) => await ability_dict['berserker'].placed!(c, row)))
    },
  },
  berserker: {
    name: 'Berserker',
    description: 'Transforms into a bear when a Mardroeme card is on its row. ',
    placed: async (card, row: Row) => {
      if (row.effects.mardroeme === 0) return
      row.removeCard(card)
      const cardId = card.name.indexOf('Young') === -1 ? 206 : 207
      await row.addCard(new Card(card_dict[cardId], card.holder))
    },
  },
  vildkarrl: {
    placed: async (card) => {
      if (card.abilities.includes('vildkarrl')) {
        removeFrom(card.abilities, 'vildkarrl')
        await playSFX('mardroeme', 1000)
        setTimeout(() => removeFrom(card.placed, ability_dict['vildkarrl'].placed!), 5000)
      }
    },
  },
  scorch: {
    name: 'Scorch',
    description: 'Discard after playing. Kills the strongest card(s) on the battlefield. ',
    activated: async (card) => {
      await ability_dict['scorch'].placed!(card)
      await ctx.board.toGrave(card, card.holder!.hand)
    },
    placed: async (card, row?: Row) => {
      if (row !== undefined) row.cards.splice(row.cards.indexOf(card), 1)
      const maxUnits = ctx.board.row.map((r) => [r, r.maxUnits()] as [Row, Card[]]).filter((p) => p[1].length > 0)
      if (row !== undefined) row.cards.push(card)
      const maxPower = maxUnits.reduce((a, p) => Math.max(a, p[1][0].power), 0)
      const scorched = maxUnits.filter((p) => p[1][0].power === maxPower)
      const cards = scorched.reduce<[Row, Card][]>((a, p) => a.concat(p[1].map((u) => [p[0], u] as [Row, Card])), [])

      if (cards.length) {
        await Promise.all(cards.map(async (u) => await u[1].animate('scorch', true, false)))
        await Promise.all(cards.map(async (u) => await ctx.board.toGrave(u[1], u[0])))
      }
    },
  },
  scorch_c: {
    name: 'Scorch - Close Combat',
    description:
      "Destroy your enemy's strongest Close Combat unit(s) if the combined strength of all his or her Close Combat units is 10 or more. ",
    placed: async (card) => await ctx.board.getCombatRow(card, 'close', card.holder!.opponent()).scorch(),
  },
  scorch_r: {
    name: 'Scorch - Ranged',
    description:
      "Destroy your enemy's strongest Ranged Combat unit(s) if the combined strength of all his or her Ranged Combat units is 10 or more. ",
    placed: async (card) => await ctx.board.getCombatRow(card, 'ranged', card.holder!.opponent()).scorch(),
  },
  scorch_s: {
    name: 'Scorch - Siege',
    description:
      "Destroys your enemy's strongest Siege Combat unit(s) if the combined strength of all his or her Siege Combat units is 10 or more. ",
    placed: async (card) => await ctx.board.getCombatRow(card, 'siege', card.holder!.opponent()).scorch(),
  },
  agile: {
    name: 'agile',
    description: 'Can be placed in either the Close Combat or the Ranged Combat row. Cannot be moved once placed. ',
  },
  muster: {
    name: 'muster',
    description: 'Find any cards with the same name in your deck and play them instantly. ',
    placed: async (card) => {
      const i = card.name.indexOf('-')
      let cardName = i === -1 ? card.name : card.name.substring(0, i)
      if (card['muster']) cardName = card['muster']
      const pred = (c: Card) => c.name.startsWith(cardName)
      const holder = card.holder!
      const units = holder.hand
        .getCards(pred)
        .map((x) => [holder.hand, x] as [CardContainer, Card])
        .concat(holder.deck.getCards(pred).map((x) => [holder.deck, x] as [CardContainer, Card]))
      if (units.length === 0) return
      await card.animate('muster')
      await Promise.all(units.map(async (p) => await ctx.board.addCardToRow(p[1], p[1].row, p[1].holder!, p[0])))
    },
  },
  spy: {
    name: 'spy',
    description:
      "Place on your opponent's battlefield (counts towards your opponent's total) and draw 2 cards from your deck. ",
    audio: 'spy',
    placed: async (card) => {
      await card.animate('spy')
      for (let i = 0; i < 2; i++) {
        if (card.holder!.deck.cards.length > 0) await card.holder!.deck.draw(card.holder!.hand)
      }
      card.holder = card.holder!.opponent()
      playSFX('draw')
    },
  },
  medic: {
    name: 'medic',
    description: 'Choose one card from your discard pile and play it instantly (no Heroes or Special Cards). ',
    audio: 'medic',
    placed: async (card) => {
      const grave = ctx.board.getRow(card, 'grave', card.holder) as Grave
      const units = card.holder!.grave.findCards((c) => c.isUnit())
      if (units.length <= 0) return
      const wrapper: { card: Card | null } = { card: null }
      const controller = ai(card.holder)
      if (ctx.game.randomRespawn) {
        const cards = grave.findCardsRandom((c) => c.isUnit())
        if (cards.length > 0) wrapper.card = cards[0]
      } else if (controller) wrapper.card = controller.medic(card, grave)
      else
        await ctx.ui.queueCarousel(
          card.holder!.grave,
          1,
          (c, i) => (wrapper.card = c.cards[i]),
          (c) => c.isUnit(),
          true,
        )
      if (wrapper.card) {
        // move card visual to top of grave
        const res = wrapper.card
        grave.removeCard(res)
        grave.addCard(res)
        let selectedRow: Row | null = null
        const isAgile = wrapper.card.row === 'agile'
        if (isAgile) {
          if (controller) {
            const close = ctx.board.getCombatRow(res, 'close', ctx.op)
            const ranged = ctx.board.getCombatRow(res, 'ranged', ctx.op)
            const closeVirtual = close.getVirtualCopy()
            const rangedVirtual = ranged.getVirtualCopy()

            closeVirtual.cards.push(res)
            closeVirtual.updateState(res, true)
            rangedVirtual.cards.push(res)
            rangedVirtual.updateState(res, true)

            const closeDif = closeVirtual.calcScore() - close.calcScore()
            const rangedDif = rangedVirtual.calcScore() - ranged.calcScore()
            const rowName =
              closeDif > rangedDif ? 'close' : closeDif < rangedDif ? 'ranged' : Math.random() < 0.5 ? 'close' : 'ranged'
            selectedRow = ctx.board.getCombatRow(res, rowName, ctx.op)
          } else {
            selectedRow = await ctx.ui.waitForRowSelection(wrapper.card)
            if (!selectedRow) return
          }
        }
        await res.animate('medic')
        if (isAgile) await ctx.board.moveTo(res, selectedRow!, grave)
        else await res.autoplay(grave)
      }
    },
  },
  morale: {
    name: 'Morale',
    description: 'Adds +1 to all units in the row (excluding itself). ',
    audio: 'morale',
    placed: async (card) => {
      await card.animate('morale')
    },
  },
  bond: {
    name: 'Tight Bond',
    description: 'Place next to a card with the same name to double the strength of both cards. ',
    audio: 'bond',
    placed: async (card) => {
      const bonds = ctx.board.getRow(card, card.row, card.holder).findCards((c) => c.name === card.name)
      if (bonds.length > 1) await Promise.all(bonds.map((c) => c.animate('bond')))
    },
  },
  avenger: {
    name: 'Avenger',
    description:
      'When this card is removed from the battlefield, it summons a powerful new Unit Card to take its place. ',
    removed: async (card) => {
      if (ctx.game.resetting) return // (fix) don't summon into the next game while the board is being reset
      const bdf = new Card(card_dict[21], card.holder)
      bdf.removed.push(() =>
        setTimeout(() => {
          if (ctx.game.isPlaying()) bdf.holder!.grave.removeCard(bdf)
        }, 1001),
      )
      await ctx.board.addCardToRow(bdf, 'close', card.holder!)
    },
    weight: () => 50,
  },
  avenger_kambi: {
    name: 'Avenger',
    description:
      'When this card is removed from the battlefield, it summons a powerful new Unit Card to take its place. ',
    removed: async (card) => {
      if (ctx.game.resetting) return
      const bdf = new Card(card_dict[196], card.holder)
      bdf.removed.push(() =>
        setTimeout(() => {
          if (ctx.game.isPlaying()) bdf.holder!.grave.removeCard(bdf)
        }, 1001),
      )
      await ctx.board.addCardToRow(bdf, 'close', card.holder!)
    },
    weight: () => 50,
  },
  foltest_king: {
    description: 'Pick an Impenetrable Fog card from your deck and play it instantly.',
    activated: async (card) => {
      const out = card.holder!.deck.findCard((c) => c.name === 'Impenetrable Fog')
      if (out) await out.autoplay(card.holder!.deck)
    },
    weight: (card, ai) => ai.weightWeatherFromDeck(card, 'fog'),
  },
  foltest_lord: {
    description:
      'Clear any weather effects (resulting from Biting Frost, Torrential Rain or Impenetrable Fog cards) in play.',
    activated: async () => await ctx.weather.clearWeather(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    weight: (_card, ai) => ai.weightCard({ row: 'weather', name: 'Clear Weather' } as any),
  },
  foltest_siegemaster: {
    description:
      'Doubles the strength of all your Siege units (unless a Commander\'s Horn is also present on that row).',
    activated: async (card) => await ctx.board.getCombatRow(card, 'siege', card.holder).leaderHorn(),
    weight: (card, ai) => ai.weightHornRow(card, ctx.board.getCombatRow(card, 'siege', card.holder)),
  },
  foltest_steelforged: {
    description:
      "Destroy your enemy's strongest Siege unit(s) if the combined strength of all his or her Siege units is 10 or more.",
    activated: async (card) => await ability_dict['scorch_s'].placed!(card),
    weight: (card, ai, max) => ai.weightScorchRow(card, max, 'siege'),
  },
  foltest_son: {
    description:
      "Destroy your enemy's strongest Ranged Combat unit(s) if the combined strength of all his or her Ranged Combat units is 10 or more.",
    activated: async (card) => await ability_dict['scorch_r'].placed!(card),
    weight: (card, ai, max) => ai.weightScorchRow(card, max, 'ranged'),
  },
  emhyr_imperial: {
    description: 'Pick a Torrential Rain card from your deck and play it instantly.',
    activated: async (card) => {
      const out = card.holder!.deck.findCard((c) => c.name === 'Torrential Rain')
      if (out) await out.autoplay(card.holder!.deck)
    },
    weight: (card, ai) => ai.weightWeatherFromDeck(card, 'rain'),
  },
  emhyr_emperor: {
    description: "Look at 3 random cards from your opponent's hand.",
    activated: async (card) => {
      if (card.holder!.controller instanceof ControllerAI) return
      const container = new CardContainer()
      container.cards = card.holder!.opponent().hand.findCardsRandom(() => true, 3)
      ctx.ui.carouselCancel()
      await ctx.ui.viewCardsInContainer(container)
    },
    weight: (card) => {
      const count = card.holder!.opponent().hand.cards.length
      return count === 0 ? 0 : Math.max(10, 10 * (8 - count))
    },
  },
  emhyr_whiteflame: {
    description: "Cancel your opponent's Leader Ability.",
  },
  emhyr_relentless: {
    description: "Draw a card from your opponent's discard pile.",
    activated: async (card) => {
      const grave = ctx.board.getRow(card, 'grave', card.holder!.opponent())
      if (grave.findCards((c) => c.isUnit()).length === 0) return
      const controller = ai(card.holder)
      if (controller) {
        const newCard = controller.medic(card, grave)
        newCard.holder = card.holder
        await ctx.board.toHand(newCard, grave)
        return
      }
      ctx.ui.carouselCancel()
      await ctx.ui.queueCarousel(
        grave,
        1,
        async (c, i) => {
          const newCard = c.cards[i]
          newCard.holder = card.holder
          await ctx.board.toHand(newCard, grave)
        },
        (c) => c.isUnit(),
        true,
      )
    },
    weight: (card, ai, _max, data) => ai.weightMedic(data, 0, card.holder!.opponent()),
  },
  emhyr_invader: {
    description:
      'Abilities that restore a unit to the battlefield restore a randomly-chosen unit. Affects both players.',
    gameStart: () => (ctx.game.randomRespawn = true),
  },
  eredin_commander: {
    description:
      "Double the strength of all your Close Combat units (unless a Commander's horn is \talso present on that row).",
    activated: async (card) => await ctx.board.getCombatRow(card, 'close', card.holder).leaderHorn(),
    weight: (card, ai) => ai.weightHornRow(card, ctx.board.getCombatRow(card, 'close', card.holder)),
  },
  eredin_bringer_of_death: {
    name: 'Eredin : Bringer of Death',
    description: 'Restore a card from your discard pile to your hand.',
    activated: async (card) => {
      let newCard: Card | undefined
      const controller = ai(card.holder)
      if (controller) {
        newCard = controller.medic(card, card.holder!.grave)
      } else {
        ctx.ui.carouselExit()
        await ctx.ui.queueCarousel(
          card.holder!.grave,
          1,
          (c, i) => (newCard = c.cards[i]),
          (c) => c.isUnit(),
          false,
          false,
        )
      }
      if (newCard) await ctx.board.toHand(newCard, card.holder!.grave)
    },
    weight: (card, ai, _max, data) => ai.weightMedic(data, 0, card.holder!),
  },
  eredin_destroyer: {
    description: 'Discard 2 card and draw 1 card of your choice from your deck.',
    activated: async (card) => {
      const hand = ctx.board.getRow(card, 'hand', card.holder)
      const deck = ctx.board.getRow(card, 'deck', card.holder)
      const controller = ai(card.holder)
      if (controller) {
        const cards = controller
          .discardOrder(card)
          .splice(0, 2)
          .filter((c) => c.basePower < 7)
        await Promise.all(cards.map(async (c) => await ctx.board.toGrave(c, card.holder!.hand)))
        card.holder!.deck.draw(card.holder!.hand)
        return
      } else ctx.ui.carouselExit()
      await ctx.ui.queueCarousel(
        hand,
        2,
        (c, i) => ctx.board.toGrave(c.cards[i], c),
        () => true,
      )
      await ctx.ui.queueCarousel(
        deck,
        1,
        (c, i) => ctx.board.toHand(c.cards[i], deck),
        () => true,
        true,
      )
    },
    weight: (card, ai) => {
      const cards = ai
        .discardOrder(card)
        .splice(0, 2)
        .filter((c) => c.basePower < 7)
      if (cards.length < 2) return 0
      return cards[0].abilities.includes('muster') ? 50 : 25
    },
  },
  eredin_king: {
    description: 'Pick any weather card from your deck and play it instantly.',
    activated: async (card) => {
      const deck = ctx.board.getRow(card, 'deck', card.holder)
      if (card.holder!.controller instanceof ControllerAI) {
        await ability_dict['eredin_king'].helper!(card).card.autoplay(card.holder!.deck)
      } else {
        ctx.ui.carouselCancel()
        await ctx.ui.queueCarousel(
          deck,
          1,
          (c, i) => ctx.board.toWeather(c.cards[i], deck),
          (c) => c.faction === 'weather',
          true,
        )
      }
    },
    weight: (card) => ability_dict['eredin_king'].helper!(card).weight,
    helper: (card) => {
      const weather = card
        .holder!.deck.cards.filter((c) => c.row === 'weather')
        .reduce<Card[]>((a, c) => (a.map((c) => c.name).includes(c.name) ? a : a.concat([c])), [])

      let out: Card | undefined,
        weight = -1
      weather.forEach((c) => {
        const w = (card.holder!.controller as ControllerAI).weightWeatherFromDeck(c, c.abilities[0])
        if (w > weight) {
          weight = w
          out = c
        }
      })
      return { card: out, weight: weight }
    },
  },
  eredin_treacherous: {
    description: 'Doubles the strength of all spy cards (affects both players).',
    gameStart: () => (ctx.game.doubleSpyPower = true),
  },
  francesca_queen: {
    description:
      "Destroy your enemy's strongest Close Combat unit(s) if the combined strength of all his or her Close Combat units is 10 or more.",
    activated: async (card) => await ability_dict['scorch_c'].placed!(card),
    weight: (card, ai, max) => ai.weightScorchRow(card, max, 'close'),
  },
  francesca_beautiful: {
    description:
      "Doubles the strength of all your Ranged Combat units (unless a Commander's Horn is also present on that row).",
    activated: async (card) => await ctx.board.getCombatRow(card, 'ranged', card.holder).leaderHorn(),
    weight: (card, ai) => ai.weightHornRow(card, ctx.board.getCombatRow(card, 'ranged', card.holder)),
  },
  francesca_daisy: {
    description: 'Draw an extra card at the beginning of the battle.',
    placed: (card) =>
      ctx.game.gameStart.push(() => {
        const draw = card.holder!.deck.removeCard(0)
        card.holder!.hand.addCard(draw)
        return true
      }),
  },
  francesca_pureblood: {
    description: 'Pick a Biting Frost card from your deck and play it instantly.',
    activated: async (card) => {
      const out = card.holder!.deck.findCard((c) => c.name === 'Biting Frost')
      if (out) await out.autoplay(card.holder!.deck)
    },
    weight: (card, ai) => ai.weightWeatherFromDeck(card, 'frost'),
  },
  francesca_hope: {
    description:
      "Move agile units to whichever valid row maximizes their strength (don't move units already in optimal row).",
    activated: async (card) => {
      const close = ctx.board.getCombatRow(card, 'close')
      const ranged = ctx.board.getCombatRow(card, 'ranged')
      const solution = ability_dict['francesca_hope'].helper!(card) as { cards: { card: Card; row: Row }[] }
      await Promise.all(
        solution.cards.map(async (p) => await ctx.board.moveTo(p.card, p.row === close ? ranged : close, p.row)),
      )
    },
    weight: (card) => {
      const { score } = ability_dict['francesca_hope'].helper!(card)
      return score
    },
    helper: (card) => {
      const close = ctx.board.getCombatRow(card, 'close')
      const ranged = ctx.board.getCombatRow(card, 'ranged')
      const agileCards = close.cards.filter((c) => c.row === 'agile').concat(ranged.cards.filter((c) => c.row === 'agile'))
      const notAgilePred = (c: Card) => c.row !== 'agile'
      const closeNorm = close.getVirtualCopy(notAgilePred)
      const rangedNorm = ranged.getVirtualCopy(notAgilePred)
      const { score, pattern } = findBest(closeNorm, rangedNorm, agileCards)
      // filter for only cards that need to change row and return
      return {
        score: score,
        cards: agileCards
          .map((c) => ({ card: c, row: close.cards.includes(c) ? close : ranged }))
          .filter((pair, i) => (pair.row === close) !== (pattern[i] === 0)),
      }

      function findBest(
        close: Row,
        ranged: Row,
        agile: Card[],
        depth = 0,
        pattern: number[] | null = null,
      ): { score: number; pattern: number[] } {
        if (agile.length === 0) return { score: -1, pattern: [] }
        else if (agile.length === depth) {
          const closeCopy = close.getVirtualCopy()
          const rangedCopy = ranged.getVirtualCopy()
          for (let i = 0; i < agile.length; ++i) {
            const row = pattern![i] === 0 ? closeCopy : rangedCopy
            row.cards.push(agile[i])
            row.updateState(agile[i], true)
          }
          return {
            score: closeCopy.calcScore() + rangedCopy.calcScore() - (close.calcScore() + ranged.calcScore()),
            pattern: pattern!,
          }
        }
        if (depth === 0) pattern = Array(agile.length).fill(0)
        const left = findBest(close, ranged, agile, depth + 1, pattern)
        const modPattern = pattern!.slice()
        modPattern[depth] = 1
        const right = findBest(close, ranged, agile, depth + 1, modPattern)
        return left.score >= right.score ? left : right
      }
    },
  },
  crach_an_craite: {
    description: "Shuffle all cards from each player's graveyard back into their decks.",
    activated: async (card) => {
      playSFX('redraw')
      Promise.all(card.holder!.grave.cards.map((c) => ctx.board.toDeck(c, card.holder!.grave)))
      await Promise.all(
        card.holder!.opponent().grave.cards.map((c) => ctx.board.toDeck(c, card.holder!.opponent().grave)),
      )
    },
    weight: (card, _ai, _max, data) => {
      if (ctx.game.roundCount < 2) return 0
      const medics = card.holder!.hand.findCard((c) => c.abilities.includes('medic'))
      if (medics !== undefined) return 0
      const spies = card.holder!.hand.findCard((c) => c.abilities.includes('spy'))
      if (spies !== undefined) return 0
      if (
        card.holder!.hand.findCard((c) => c.abilities.includes('decoy')) !== undefined &&
        (data.medic.length ||
          (data.spy.length && card.holder!.deck.findCard((c) => c.abilities.includes('medic')) !== undefined))
      )
        return 0
      return 15
    },
  },
  king_bran: {
    description: 'Units only lose half their Strength in bad weather conditions.',
    placed: (card) =>
      ctx.board.row.filter((_c, i) => (card.holder === ctx.me) !== i < 3).forEach((r) => (r.effects.halfWeather = true)),
  },
}
