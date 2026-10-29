import { reactive } from 'vue'
import type { Card } from './card'
import { CardContainer, Row } from './containers'
import { ctx } from './context'
import { ControllerAI } from './ai'
import type { Player } from './player'
import { isString } from './util'

export class Board {
  row: Row[] = []

  constructor() {
    // field-op children: siege, ranged, close | field-me children: close, ranged, siege
    const types = ['siege', 'ranged', 'close', 'close', 'ranged', 'siege']
    for (let x = 0; x < 6; ++x) this.row[x] = new Row(types[x], x)
    return reactive(this) as Board
  }

  // Get the opponent of this Player
  opponent(player: Player) {
    return player === ctx.me ? ctx.op : ctx.me
  }

  // Sends and translates a card from the source to the Deck of the card's holder
  async toDeck(card: Card, source: CardContainer) {
    await this.moveTo(card, 'deck', source)
  }

  // Sends and translates a card from the source to the Grave of the card's holder
  async toGrave(card: Card, source: CardContainer) {
    await this.moveTo(card, 'grave', source)
  }

  // Sends and translates a card from the source to the Hand of the card's holder
  async toHand(card: Card, source: CardContainer) {
    await this.moveTo(card, 'hand', source)
  }

  // Sends and translates a card from the source to Weather
  async toWeather(card: Card, source: CardContainer) {
    await this.moveTo(card, ctx.weather, source)
  }

  // Sends and translates a card from the source to the card's combat row
  async toRow(card: Card, source: CardContainer) {
    let row = card.row
    if (row === 'agile') {
      if (card.holder!.controller instanceof ControllerAI) row = card.holder!.controller.determineAgileRow(card).type
      else row = 'close'
    }
    await this.moveTo(card, row, source)
  }

  // Sends and translates a card from the source to a specified row name or CardContainer
  async moveTo(card: Card, dest: string | CardContainer, source?: CardContainer | null) {
    const d = isString(dest) ? this.getRow(card, dest) : dest
    await ctx.ui.translateTo(card, source ? source : null, d)
    await d.addCard(source ? source.removeCard(card) : card)
  }

  // Sends and translates a card from the source to a row name associated with the passed player
  async addCardToRow(card: Card, row_name: string, player: Player, source?: CardContainer) {
    const row = this.getRow(card, row_name, player)
    await ctx.ui.translateTo(card, source, row)
    await row.addCard(card)
  }

  // Returns the CardContainer associated with the row name that the card would be sent to
  getRow(card: Card | null, row_name: string, player?: Player | null): CardContainer {
    player = player ? player : card ? card.holder! : ctx.me
    const isMe = player === ctx.me
    const isSpy = !!card && card.abilities.includes('spy')
    switch (row_name) {
      case 'weather':
        return ctx.weather
      case 'close':
        return this.row[isMe !== isSpy ? 3 : 2]
      case 'ranged':
        return this.row[isMe !== isSpy ? 4 : 1]
      case 'siege':
        return this.row[isMe !== isSpy ? 5 : 0]
      case 'grave':
        return player.grave
      case 'deck':
        return player.deck
      case 'hand':
        return player.hand
      default:
        console.error(card?.name + ' sent to incorrect row "' + row_name + '" by ' + card?.holder?.name)
        return undefined as unknown as CardContainer
    }
  }

  /** Typed helper for the three combat rows */
  getCombatRow(card: Card | null, row_name: string, player?: Player | null): Row {
    return this.getRow(card, row_name, player) as Row
  }

  // Updates which player currently is in the lead
  updateLeader() {
    const dif = ctx.me.total - ctx.op.total
    ctx.me.setWinning(dif > 0)
    ctx.op.setWinning(dif < 0)
  }

  async clearRound() {
    await Promise.all([await ctx.weather.clearWeather(), ...this.row.map(async (row) => await row.clear())])
  }
}
