import { reactive } from 'vue'
import { Card } from './card'
import { Deck, Grave, Hand, HandAI } from './containers'
import { ControllerAI, Controller } from './ai'
import { ctx } from './context'
import { factions } from './factions'
import { ability_dict } from './abilities'
import type { DeckData } from './types'
import { sleep } from './util'
import type { Row } from './containers'

// Can make actions during turns like playing cards that it owns
export class Player {
  id!: number | string
  tag!: 'me' | 'op'
  controller!: Controller | ControllerAI
  hand!: Hand | HandAI
  grave!: Grave
  deck!: Deck
  deck_data!: DeckData
  leader!: Card
  name!: string
  /** faction display name */
  deckName!: string

  health = 2
  total = 0
  passed = false
  handsize = 10
  winning = false
  leaderAvailable = false

  // ---- presentation state (CSS classes in the original) ----
  isTurn = false
  leaderActiveShown = true
  leaderFaded = false
  leaderPlayable = false

  constructor(id: number | string, name: string, deck: DeckData) {
    const self = reactive(this) as Player // never leak the raw object (identity checks!)
    self.id = id
    self.tag = id === 0 ? 'me' : 'op'
    self.hand = id === 0 ? new Hand('hand-me') : new HandAI('hand-op')
    self.grave = new Grave('grave-' + self.tag)
    self.deck = new Deck(deck.faction, 'deck-' + self.tag)
    self.deck_data = deck
    self.controller = id === 0 ? new Controller() : new ControllerAI(self)
    self.leader = new Card(deck.leader, self)
    self.reset()
    self.name = name
    self.deckName = factions[deck.faction as keyof typeof factions].name
    return self
  }

  // Sets default values
  reset() {
    this.grave.reset()
    this.hand.reset()
    this.deck.reset()
    this.deck.initializeFromID(this.deck_data.cards, this)

    this.health = 2
    this.total = 0
    this.passed = false
    this.handsize = 10
    this.winning = false
    this.isTurn = false

    this.enableLeader()
    this.setPassed(false)
  }

  // Returns the opponent Player
  opponent(): Player {
    return ctx.board.opponent(this)
  }

  // Updates the player's total score and notifies the game
  updateTotal(n: number) {
    this.total += n
    ctx.board.updateLeader()
  }

  // Puts the player in the winning state
  setWinning(isWinning: boolean) {
    this.winning = isWinning
  }

  // Puts the player in the passed state
  setPassed(hasPassed: boolean) {
    this.passed = hasPassed
  }

  // Sets up board for turn
  async startTurn() {
    this.isTurn = true
    if (this.leaderAvailable) this.leaderActiveShown = true
    if (this === ctx.me) ctx.ui.setPassEnabled(true)
    if (this.controller instanceof ControllerAI) await this.controller.startTurn(this)
  }

  // Passes the round and ends the turn
  passRound() {
    this.setPassed(true)
    this.endTurn()
  }

  // Plays a scorch card
  async playScorch(card: Card) {
    await this.playCardAction(card, async () => await ability_dict['scorch'].activated!(card))
  }

  // Plays a card to a specific row
  async playCardToRow(card: Card, row: Row) {
    await this.playCardAction(card, async () => await ctx.board.moveTo(card, row, this.hand))
  }

  // Plays a card to the board
  async playCard(card: Card) {
    await this.playCardAction(card, async () => await card.autoplay(this.hand))
  }

  // Shows a preview of the card being played, plays it to the board and ends the turn
  async playCardAction(card: Card, action: () => Promise<unknown>) {
    ctx.ui.showPreviewVisuals(card)
    await sleep(1000)
    ctx.ui.hidePreview()
    await action()
    this.endTurn()
  }

  // Handles end of turn visuals and behavior then notifies the game
  endTurn() {
    if (!this.passed && !this.canPlay()) this.setPassed(true)
    if (this === ctx.me) ctx.ui.setPassEnabled(false)
    this.isTurn = false
    this.leaderActiveShown = false
    ctx.game.endTurn()
  }

  // Tells the Player if it won the round. May damage health.
  endRound(win: boolean) {
    if (!win) {
      if (this.health < 1) return
      this.health--
    }
    this.setPassed(false)
    this.setWinning(false)
  }

  // Returns true if the Player can make any action other than passing
  canPlay() {
    return this.hand.cards.length > 0 || this.leaderAvailable
  }

  // Use a leader's Activate ability, then disable the leader
  async activateLeader() {
    ctx.ui.showPreviewVisuals(this.leader)
    await sleep(1500)
    ctx.ui.hidePreview()
    await this.leader.activated[0](this.leader, this)
    this.disableLeader()
    this.endTurn()
  }

  // Disable access to leader ability and toggles leader visuals to off state
  disableLeader() {
    this.leaderAvailable = false
    this.leaderFaded = true
    this.leaderActiveShown = false
    this.leaderPlayable = false
  }

  // Enable access to leader ability and toggles leader visuals to on state
  enableLeader() {
    this.leaderAvailable = this.leader.activated.length > 0
    this.leaderFaded = false
    this.leaderActiveShown = true
    this.leaderPlayable = this.id === 0 && this.leader.activated.length > 0
  }
}
