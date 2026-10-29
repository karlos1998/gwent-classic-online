// Engine bootstrap: creates the singletons the original created at the bottom of gwent.js
import { ctx, type AudioPort, type UIPort } from './context'
import { Board } from './board'
import { Weather } from './containers'
import { Game } from './game'

export function createEngine(ui: UIPort, audio: AudioPort) {
  ctx.ui = ui
  ctx.audio = audio
  ctx.board = new Board()
  ctx.weather = new Weather(ctx.board.row)
  ctx.game = new Game()
  ctx.game.reset()
  return ctx
}

export { ctx } from './context'
export { Card, abilityIconKey } from './card'
export { Player } from './player'
export { CardContainer, Row, Weather, Hand, HandAI, Deck, Grave } from './containers'
export { GameState } from './game'
export { factions } from './factions'
export { card_dict } from './data/cards'
export { premade_deck } from './data/decks'
export { constructOpponentDeck } from './decks'
export { ControllerAI } from './ai'
export * from './types'
export * from './util'
