// Computer opponent - ported 1:1 from the original ControllerAI (gwent.js)
import { markRaw } from 'vue'
import { Card } from './card'
import { CardContainer, type Row } from './containers'
import { ctx } from './context'
import { ability_dict } from './abilities'
import type { Player } from './player'
import { randomInt } from './util'

/** Local human player (input comes from the UI) */
export class Controller {}

interface RowMax {
  row: Row
  cards: Card[]
}
export interface MaxData {
  rmax: RowMax[]
  me: { row: RowMax; card: Card }[]
  op: { row: RowMax; card: Card }[]
}
export interface BoardData {
  spy: Card[]
  medic: Card[]
  bond: Record<string, number>
  scorch: Card[]
  grave_me?: BoardData
  grave_op?: BoardData
}

// Makes decisions for the AI opponent player
export class ControllerAI {
  player: Player

  constructor(player: Player) {
    this.player = player
    markRaw(this)
  }

  // Collects data and weighs options before taking a weighted random action
  async startTurn(player: Player) {
    if (
      player.opponent().passed &&
      (player.winning || (player.deck.faction === 'nilfgaard' && player.total === player.opponent().total))
    ) {
      await player.passRound()
      return
    }
    const data_max = this.getMaximums()
    const data_board = this.getBoardData()
    const weights = player.hand.cards.map((c) => ({
      weight: this.weightCard(c, data_max, data_board),
      action: async () => await this.playCard(c, data_max, data_board),
    }))
    if (player.leaderAvailable)
      weights.push({
        weight: this.weightLeader(player.leader, data_max, data_board),
        action: async () => await player.activateLeader(),
      })
    weights.push({ weight: this.weightPass(), action: async () => await player.passRound() })
    const weightTotal = weights.reduce((a, c) => a + c.weight, 0)
    // (fix) original: `weightTotal === 0`. Some weights use -1 as a sentinel (e.g. Francesca "Hope" with no agile
    // units, Eredin "King" with no weather in deck) and a negative total made the AI crash/freeze its turn.
    if (weightTotal <= 0 || Number.isNaN(weightTotal)) {
      for (let i = 0; i < player.hand.cards.length; ++i) {
        const card = player.hand.cards[i]
        if ((card.row === 'weather' && this.weightWeather(card) > -1) || card.abilities.includes('avenger')) {
          await weights[i].action()
          return
        }
      }
      await player.passRound()
    } else {
      let rand = randomInt(weightTotal)
      let i
      for (i = 0; i < weights.length; ++i) {
        rand -= weights[i].weight
        if (rand < 0) break
      }
      // (fix) the original crashed here when the weights summed to a negative number/NaN
      // (e.g. Eredin "King of the Wild Hunt" with no weather left in the deck weighs -1) - fall back to passing
      if (!weights[i]) {
        console.warn('[AI] no action picked, weights:', weights.map((w) => w.weight))
        i = weights.length - 1
      }
      await weights[i].action()
    }
  }

  // Collects data about card with the highest power on the board
  getMaximums(): MaxData {
    const board = ctx.board
    const rmax: RowMax[] = board.row.map((r) => ({
      row: r,
      cards: r.cards
        .filter((c) => c.isUnit())
        .reduce<Card[]>(
          (a, c) => (!a.length || a[0].power < c.power ? [c] : a[0].power === c.power ? a.concat([c]) : a),
          [],
        ),
    }))

    let max = rmax.filter((r, i) => r.cards.length && i < 3).reduce((a, r) => Math.max(a, r.cards[0].power), 0)
    const max_me = rmax
      .filter((r, i) => i < 3 && r.cards.length && r.cards[0].power === max)
      .reduce<{ row: RowMax; card: Card }[]>((a, r) => a.concat(r.cards.map((c) => ({ row: r, card: c }))), [])

    max = rmax.filter((r, i) => r.cards.length && i > 2).reduce((a, r) => Math.max(a, r.cards[0].power), 0)
    const max_op = rmax
      .filter((r, i) => i > 2 && r.cards.length && r.cards[0].power === max)
      .reduce<{ row: RowMax; card: Card }[]>((a, r) => a.concat(r.cards.map((c) => ({ row: r, card: c }))), [])

    return { rmax: rmax, me: max_me, op: max_op }
  }

  // Collects data about the types of cards on the board and in each player's graves
  getBoardData(): BoardData {
    const data = this.countCards(new CardContainer())
    ;[0, 1, 2].map((i) => ctx.board.row[i]).forEach((r) => this.countCards(r, data))
    data.grave_me = this.countCards(this.player.grave)
    data.grave_op = this.countCards(this.player.opponent().grave)
    return data
  }

  // Catalogs the kinds of cards in a given CardContainer
  countCards(container: CardContainer, data?: BoardData): BoardData {
    data = data ? data : { spy: [], medic: [], bond: {}, scorch: [] }
    const d = data
    container.cards
      .filter((c) => c.isUnit())
      .forEach((c) => {
        for (const x of c.abilities) {
          switch (x) {
            case 'spy':
            case 'medic':
              d[x].push(c)
              break
            case 'scorch_r':
            case 'scorch_c':
            case 'scorch_s':
              d['scorch'].push(c)
              break
            case 'bond':
              if (!d.bond[c.name]) d.bond[c.name] = 0
              d.bond[c.name]++
          }
        }
      })
    return data
  }

  // Swaps a card from the hand with the deck if beneficial
  redraw() {
    const card = this.discardOrder({ holder: this.player } as Card)[0]
    if (card && card.power < 15) this.player.deck.swap(this.player.hand, card)
  }

  // Orders discardable cards from most to least discardable
  discardOrder(card: Card): Card[] {
    const cards: Card[] = []
    const groups: Record<string, Card[]> = {}
    const musters = card.holder!.hand.cards.filter((c) => c.abilities.includes('muster'))
    while (musters.length > 0) {
      const curr = musters.pop()!
      const i = curr.name.indexOf('-')
      const name = i === -1 ? curr.name : curr.name.substring(0, i).trim()
      if (!groups[name]) groups[name] = []
      const group = groups[name]
      group.push(curr)
      for (let j = musters.length - 1; j >= 0; j--) if (musters[j].name.startsWith(name)) group.push(musters.splice(j, 1)[0])
    }

    for (const group of Object.values(groups)) {
      group.sort(Card.compare)
      group.pop()
      cards.push(...group)
    }

    const weathers = card.holder!.hand.cards.filter((c) => c.row === 'weather')
    if (weathers.length > 1) {
      weathers.splice(randomInt(weathers.length), 1)
      cards.push(...weathers)
    }

    const normal = card.holder!.hand.cards.filter((c) => c.abilities.length === 0)
    normal.sort(Card.compare)
    cards.push(...normal)
    return cards
  }

  // Tells the Player that this object controls to play a card
  async playCard(c: Card, max: MaxData, data: BoardData) {
    if (c.name === "Commander's Horn") await this.horn(c)
    else if (c.name === 'Mardroeme') await this.mardroeme(c)
    else if (c.name === 'Decoy') await this.decoy(c, max, data)
    else if (c.name === 'Scorch') await this.scorch(c)
    else await this.player.playCard(c)
  }

  // Plays a Commander's Horn to the most beneficial row. Assumes at least one viable row.
  async horn(card: Card) {
    const rows = [0, 1, 2].map((i) => ctx.board.row[i]).filter((r) => r.special === null)
    let max_row: Row | undefined
    let max = 0
    for (let i = 0; i < rows.length; ++i) {
      const r = rows[i]
      const dif = [0, 0]
      this.calcRowPower(r, dif, true)
      r.effects.horn++
      this.calcRowPower(r, dif, false)
      r.effects.horn--
      const score = dif[1] - dif[0]
      if (max < score) {
        max = score
        max_row = r
      }
    }
    await this.player.playCardToRow(card, max_row!)
  }

  // Plays a Mardroeme to the most beneficial row. Assumes at least one viable row.
  async mardroeme(card: Card) {
    // TODO skellige
    let row: Row | undefined,
      max = 0
    for (let i = 1; i < 3; i++) {
      const curr = this.weightMardroemeRow(card, ctx.board.row[i])
      if (curr > max) {
        max = curr
        row = ctx.board.row[i]
      }
    }
    await this.player.playCardToRow(card, row!)
  }

  // Selects a card to remove from a Grave. Assumes at least one valid card.
  medic(_card: Card, grave: CardContainer): Card {
    const data = this.countCards(grave)
    let targ: Card
    if (data.spy.length) {
      const min = data.spy.reduce((a, c) => Math.min(a, c.power), Number.MAX_VALUE)
      targ = data.spy.filter((c) => c.power === min)[0]
    } else if (data.medic.length) {
      const max = data.medic.reduce((a, c) => Math.max(a, c.power), Number.MIN_VALUE)
      targ = data.medic.filter((c) => c.power === max)[0]
    } else if (data.scorch.length) {
      targ = data.scorch[randomInt(data.scorch.length)]
    } else {
      const units = grave.findCards((c) => c.isUnit())
      targ = units.reduce((a, c) => (a.power < c.power ? c : a), units[0])
    }
    return targ
  }

  // Selects a card to return to the Hand and replaces it with a Decoy. Assumes at least one valid card.
  async decoy(card: Card, max: MaxData, data: BoardData) {
    let targ: Card, row: Row | undefined
    if (data.spy.length) {
      const min = data.spy.reduce((a, c) => Math.min(a, c.power), Number.MAX_VALUE)
      targ = data.spy.filter((c) => c.power === min)[0]
    } else if (data.medic.length) {
      targ = data.medic[randomInt(data.medic.length)]
    } else if (data.scorch.length) {
      targ = data.scorch[randomInt(data.scorch.length)]
    } else {
      const pairs = max.rmax
        .filter((r, i) => i < 3 && r.cards.length)
        .reduce<{ r: Row; c: Card }[]>((a, r) => r.cards.map((c) => ({ r: r.row, c: c })).concat(a), [])
      const pair = pairs[randomInt(pairs.length)]
      targ = pair.c
      row = pair.r
    }

    for (let i = 0; !row; ++i) {
      if (ctx.board.row[i].cards.indexOf(targ) !== -1) {
        row = ctx.board.row[i]
        break
      }
    }

    const r = row
    setTimeout(() => ctx.board.toHand(targ, r), 1000)
    await this.player.playCardToRow(card, r)
  }

  // Tells the controlled Player to play the Scorch card
  async scorch(card: Card) {
    await this.player.playScorch(card)
  }

  // Gets the row that would be best for the passed agile card
  determineAgileRow(card: Card): Row {
    const close = ctx.board.getCombatRow(card, 'close', card.holder)
    const ranged = ctx.board.getCombatRow(card, 'ranged', card.holder)
    const vClose = close.getVirtualCopy()
    const vRanged = ranged.getVirtualCopy()
    vClose.cards.push(card)
    vClose.updateState(card, true)
    vRanged.cards.push(card)
    vRanged.updateState(card, true)
    const dif = vClose.calcScore() - close.calcScore() - (vRanged.calcScore() - ranged.calcScore())
    return dif > 0 ? close : dif < 0 ? ranged : Math.random() > 0.5 ? close : ranged
  }

  // Assigns a weight for how likely the controller is to Pass the round
  weightPass() {
    if (this.player.health === 1) return 0
    const dif = this.player.opponent().total - this.player.total
    if (dif > 30) return 100
    if (dif < -30 && this.player.opponent().handsize - this.player.handsize > 2) return 100
    return Math.floor(Math.abs(dif))
  }

  // Assigns a weight for how likely the controller is to activate its leader ability
  weightLeader(card: Card, max: MaxData, data: BoardData) {
    const w = ability_dict[card.abilities[0]].weight
    if (w) {
      const score = w(card, this, max, data)
      return score
    }
    return 10 + (ctx.game.roundCount - 1) * 15
  }

  // Assigns a weight for how likely the controller will use a scorch-row card
  weightScorchRow(_card: Card, max: MaxData, row_name: string) {
    const index = 3 + (row_name === 'close' ? 0 : row_name === 'ranged' ? 1 : 2)
    if (ctx.board.row[index].total < 10) return 0
    const score = max.rmax[index].cards.reduce((a, c) => a + c.power, 0)
    return score
  }

  // Calculates a weight for how likely the controller will use horn on this row
  weightHornRow(card: Card, row: Row) {
    return row.special !== null ? 0 : this.weightRowChange(card, row)
  }

  // Calculates weight for playing a card on a given row, min 0
  weightRowChange(card: Card, row: Row) {
    return Math.max(0, this.weightRowChangeTrue(card, row))
  }

  // Calculates weight for playing a card on the given row
  weightRowChangeTrue(card: Card, row: Row) {
    const dif = [0, 0]
    this.calcRowPower(row, dif, true)
    row.updateState(card, true)
    this.calcRowPower(row, dif, false)
    if (!card.isSpecial()) dif[0] -= row.calcCardScore(card)
    row.updateState(card, false)
    return dif[1] - dif[0]
  }

  // Calculates the weight for playing a weather card
  weightWeather(card: { name: string; abilities: string[] }) {
    let rows: Row[]
    const types = Object.values(ctx.weather.types)
    if (card.name === 'Clear Weather') rows = types.filter((t) => t.count > 0).flatMap((t) => t.rows)
    else rows = types.filter((t) => t.count === 0 && t.name === card.abilities[0]).flatMap((t) => t.rows)
    if (!rows.length) return 1
    const dif = [0, 0]
    rows.forEach((r) => {
      const state = r.effects.weather
      this.calcRowPower(r, dif, true)
      r.effects.weather = !state
      this.calcRowPower(r, dif, false)
      r.effects.weather = state
    })
    return dif[1] - dif[0]
  }

  // Calculates the weight for playing a mardroeme card
  weightMardroemeRow(card: Card, row: Row) {
    if (card.name === 'Mardroeme' && row.special !== null) return 0
    const ermion = card.holder!.hand.cards.filter((c) => c.name === 'Ermion').length > 0
    if (ermion && card.name !== 'Ermion' && row === ctx.board.row[1]) return 0
    const name = row === ctx.board.row[1] ? 'Young Berserker' : 'Berserker'
    const n = row.cards.filter((c) => c.name === name).length
    const weight = row === ctx.board.row[2] ? 10 * n : 8 * n * n - 2 * n
    return Math.max(1, weight)
  }

  // Calculates the weight for cards with the medic ability
  weightMedic(data: BoardData, score: number, owner: Player) {
    const units = owner.grave.findCards((c) => c.isUnit())
    const grave = (data as unknown as Record<string, BoardData>)['grave_' + owner.opponent().tag]
    return !units.length
      ? Math.min(1, score)
      : score +
          (grave.spy.length ? 50 : grave.medic.length ? 15 : grave.scorch.length ? 10 : this.player.health === 1 ? 1 : 0)
  }

  // Calculates the weight for cards with the berserker ability
  weightBerserker(card: Card, row: Row, score: number) {
    // NOTE: "!row.effects.mardroeme > 0" kept verbatim from the original ((!x) > 0, i.e. "no mardroeme on row")
    if (
      card.holder!.hand.cards.filter((c) => c.abilities.includes('mardroeme')).length < 1 &&
      (!row.effects.mardroeme as unknown as number) > 0
    )
      return score
    score -= card.basePower
    if (card.row === 'close') score += 14
    else {
      let n = 0
      if (!row.effects.mardroeme) n = row.cards.filter((c) => c.name === 'Young Berserker').length
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      else n = row.cards.filter((_c) => 'Transformed Young Vildkaarl').length
      score = 8 * ((n + 1) * (n + 1) - n * n) + n * score
    }
    return Math.max(1, score)
  }

  // Calculates the weight for a weather card if played from the deck
  weightWeatherFromDeck(card: Card, weather_id: string) {
    if (card.holder!.deck.findCard((c) => c.abilities.includes(weather_id)) === undefined) return 0
    return this.weightCard({ abilities: [weather_id], row: 'weather' } as unknown as Card)
  }

  // Assigns a weight for how likely the controller will play a card from its hand
  weightCard(card: Card, max?: MaxData, data?: BoardData): number {
    if (card.name === 'Decoy')
      return data!.spy.length ? 50 : data!.medic.length ? 15 : data!.scorch.length ? 10 : max!.me.length ? 1 : 0
    if (card.name === "Commander's Horn") {
      const rows = [0, 1, 2].map((i) => ctx.board.row[i]).filter((r) => r.special === null)
      if (!rows.length) return 0
      const w = rows.map((r) => this.weightHornRow(card, r))
      return Math.max(...w) / 2
    }

    if (card.abilities) {
      if (card.abilities.includes('scorch')) {
        const power_op = max!.op.length ? max!.op[0].card.power : 0
        const power_me = max!.me.length ? max!.me[0].card.power : 0
        const total_op = power_op * max!.op.length
        const total_me = power_me * max!.me.length
        return power_me > power_op ? 0 : power_me < power_op ? total_op : Math.max(0, total_op - total_me)
      }
      if (card.abilities.includes('decoy')) {
        return data!.spy.length ? 50 : data!.medic.length ? 15 : data!.scorch.length ? 10 : max!.me.length ? 1 : 0
      }
      if (card.abilities.includes('mardroeme')) {
        const rows = [1, 2].map((i) => ctx.board.row[i])
        return Math.max(...rows.map((r) => this.weightMardroemeRow(card, r)))
      }
    }

    if (card.row === 'weather') {
      return Math.max(0, this.weightWeather(card))
    }

    let row: Row
    if (card.row === 'agile') row = this.determineAgileRow(card)
    else row = ctx.board.getCombatRow(card, card.row, this.player)
    let score = row.calcCardScore(card)
    switch (card.abilities[card.abilities.length - 1]) {
      case 'bond':
      case 'morale':
      case 'horn':
        score = this.weightRowChange(card, row)
        break
      case 'medic':
        score = this.weightMedic(data!, score, card.holder!)
        break
      case 'spy':
        score = 15 + score
        break
      case 'muster':
        score *= 3
        break
      case 'scorch_c':
        score = Math.max(1, this.weightScorchRow(card, max!, 'close'))
        break
      case 'scorch_r':
        score = Math.max(1, this.weightScorchRow(card, max!, 'ranged'))
        break
      case 'scorch_s':
        score = Math.max(1, this.weightScorchRow(card, max!, 'siege'))
        break
      case 'berserker':
        score = this.weightBerserker(card, row, score)
        break
      case 'avenger':
      case 'avenger_kambi':
        return score + ability_dict[card.abilities[card.abilities.length - 1]].weight!(card, this)
    }

    return score
  }

  // Calculates the current power of a row associated with each Player
  calcRowPower(r: Row, dif: number[], add: boolean) {
    r.findCards((c) => c.isUnit()).forEach((c) => {
      const p = r.calcCardScore(c)
      if (c.holder === this.player) dif[0] += add ? p : -p
      else dif[1] += add ? p : -p
    })
  }
}
