// Game flow - ported 1:1 from the original Game class (gwent.js)
import { reactive } from 'vue'
import { ability_dict } from './abilities'
import { factions } from './factions'
import { ctx, playSFX } from './context'
import type { Player } from './player'
import type { Effect } from './types'
import { runtime } from './util'

export enum GameState {
  CUSTOMIZE = 0,
  PLAYING = 10,
  END_SCREEN = 100,
}

export interface RoundVerdict {
  winner: Player | null
  score_me: number
  score_op: number
}

export class Game {
  state: GameState = GameState.CUSTOMIZE
  firstPlayer: Player | null = null
  currPlayer: Player | null = null
  gameStart: Effect[] = []
  roundStart: Effect[] = []
  roundEnd: Effect[] = []
  turnStart: Effect[] = []
  turnEnd: Effect[] = []
  roundCount = 0
  roundHistory: RoundVerdict[] = []
  randomRespawn = false
  doubleSpyPower = false
  placedEffectsActive = false //TODO replace with proper game state
  /** true while reset() clears the board (prevents avenger summons leaking into the next game) */
  resetting = false

  /** Called by "New Game" on the end screen: builds a fresh random AI opponent */
  newOpponentFactory: (() => Player) | null = null

  constructor() {
    const self = reactive(this) as Game
    return self
  }

  reset() {
    runtime.epoch++ // aborts coroutines of a game that was quit mid-turn
    this.resetting = true
    this.firstPlayer = null
    this.currPlayer = null

    this.gameStart = []
    this.roundStart = []
    this.roundEnd = []
    this.turnStart = []
    this.turnEnd = []

    this.roundCount = 0
    this.roundHistory = []

    this.randomRespawn = false
    this.doubleSpyPower = false

    this.placedEffectsActive = false

    ctx.weather.reset()
    ctx.board.row.forEach((r) => r.reset())
    this.resetting = false
  }

  // Sets up player faction abilities and passive leader abilities
  initPlayers(p1: Player, p2: Player) {
    const l1 = ability_dict[p1.leader.abilities[0]]
    const l2 = ability_dict[p2.leader.abilities[0]]
    if (l1 === ability_dict['emhyr_whiteflame'] || l2 === ability_dict['emhyr_whiteflame']) {
      p1.disableLeader()
      p2.disableLeader()
    } else {
      initLeader(p1, l1)
      initLeader(p2, l2)
    }
    if (p1.deck.faction === p2.deck.faction && p1.deck.faction === 'scoiatael') return
    initFaction(p1)
    initFaction(p2)

    function initLeader(player: Player, leader: (typeof ability_dict)[string]) {
      if (leader.placed) leader.placed(player.leader)
      const g = ctx.game as unknown as Record<string, unknown>
      ;(Object.keys(leader) as (keyof typeof leader)[])
        .filter((key) => Array.isArray(g[key]))
        .map((key) => (g[key] as unknown[]).push(leader[key]))
    }

    function initFaction(player: Player) {
      const f = factions[player.deck.faction as keyof typeof factions]
      if (f && f.factionAbility) f.factionAbility(player)
    }
  }

  // NOTE: kept from the original - returns true on the END screen (used by avenger cleanup)
  isPlaying() {
    return this.state === GameState.END_SCREEN
  }

  setState(newState: GameState) {
    if (this.state === newState) return
    this.state = newState
  }

  // Initializes player abilities, player hands and redraw
  async startGame() {
    ctx.ui.onGameOpened()
    this.initPlayers(ctx.me, ctx.op)
    this.setState(GameState.PLAYING)
    playSFX('game_opening')
    await this.runEffects(this.gameStart)
    await this.coinToss()
    playSFX('redraw')
    await Promise.all(
      [...Array(10).keys()].map(async () => {
        await ctx.me.deck.draw(ctx.me.hand)
        await ctx.op.deck.draw(ctx.op.hand)
      }),
    )
    playSFX('game_start')
    await this.initialRedraw()
    this.currPlayer = this.firstPlayer
    this.startRound()
  }

  // Simulated coin toss to determine who starts game
  async coinToss() {
    if (this.firstPlayer) return
    this.firstPlayer = Math.random() < 0.5 ? ctx.me : ctx.op
    await ctx.ui.notification(this.firstPlayer.tag + '-coin', 1200)
  }

  // Allows the player to swap out up to two cards from their initial hand
  async initialRedraw() {
    for (let i = 0; i < 2; i++) (ctx.op.controller as import('./ai').ControllerAI).redraw()
    await ctx.ui.queueCarousel(
      ctx.me.hand,
      2,
      async (c, i) => {
        playSFX('redraw')
        await ctx.me.deck.swap(c, c.cards[i])
      },
      () => true,
      false,
      true,
      'Choose up to 2 cards to redraw.',
    )
    ctx.ui.enablePlayer(false)
  }

  // Initiates a new round of the game
  async startRound(): Promise<void> {
    this.firstPlayer = this.currPlayer
    this.roundCount++
    if (this.roundCount === 1) playSFX('round1_start')
    await this.runEffects(this.roundStart)

    if (!ctx.me.canPlay()) ctx.me.setPassed(true)
    if (!ctx.op.canPlay()) ctx.op.setPassed(true)

    if (ctx.op.passed && ctx.me.passed) return this.endRound()

    if (this.currPlayer!.passed) this.currPlayer = this.currPlayer!.opponent()

    await ctx.ui.notification('round-start', 1200)
    playSFX(this.currPlayer === ctx.me ? 'turn_me' : 'turn_op')
    await ctx.ui.notification(this.currPlayer!.tag + '-turn', 1200)
    this.startTurn()
  }

  // Starts a new turn. Enables client interaction in client's turn.
  async startTurn() {
    await this.runEffects(this.turnStart)
    ctx.ui.enablePlayer(this.currPlayer === ctx.me)
    this.currPlayer!.startTurn()
  }

  // Ends the current turn and may end round. Disables client interaction in client's turn.
  async endTurn() {
    if (this.currPlayer === ctx.me) ctx.ui.enablePlayer(false)
    await this.runEffects(this.turnEnd)
    if (this.currPlayer!.passed) await ctx.ui.notification(this.currPlayer!.tag + '-pass', 1200)
    if (ctx.op.passed && ctx.me.passed) this.endRound()
    else {
      if (!this.currPlayer!.opponent().passed) {
        this.currPlayer = this.currPlayer!.opponent()
        playSFX(this.currPlayer === ctx.me ? 'turn_me' : 'turn_op')
        await ctx.ui.notification(this.currPlayer.tag + '-turn', 1200)
      }
      await this.startTurn()
    }
  }

  // Ends the round and may end the game. Determines final scores and the round winner.
  async endRound() {
    const me = ctx.me,
      op = ctx.op
    let dif = me.total - op.total
    if (dif === 0) {
      const nilf_me = me.deck.faction === 'nilfgaard',
        nilf_op = op.deck.faction === 'nilfgaard'
      dif = nilf_me !== nilf_op ? (nilf_me ? 1 : -1) : 0
    }
    const winner = dif > 0 ? me : dif < 0 ? op : null
    const verdict = { winner: winner, score_me: me.total, score_op: op.total }
    this.roundHistory.push(verdict)

    await this.runEffects(this.roundEnd)

    me.endRound(dif > 0)
    op.endRound(dif < 0)

    let notificationKey = ''
    if (dif > 0) {
      playSFX('round_win')
      notificationKey = 'win-round'
    } else if (dif < 0) {
      playSFX('round_lose')
      notificationKey = 'lose-round'
    } else {
      playSFX('round_lose')
      notificationKey = 'draw-round'
    }

    await Promise.all([await ctx.board.clearRound(), await ctx.ui.notification(notificationKey, 1200)])

    if (me.health === 0 || op.health === 0) this.endGame()
    else {
      this.currPlayer = dif < 0 ? op : dif > 0 ? me : this.firstPlayer
      this.startRound()
    }
  }

  // Sets up and displays the end-game screen
  async endGame() {
    const me = ctx.me,
      op = ctx.op
    const rounds = [0, 1, 2].map((i) => {
      const round = this.roundHistory[i]
      return {
        me: round ? round.score_me : 0,
        op: round ? round.score_op : 0,
        meWon: !!round && round.winner === me,
        opWon: !!round && round.winner === op,
      }
    })
    let result: 'win' | 'lose' | 'draw'
    if (op.health <= 0 && me.health <= 0) {
      playSFX('game_lose')
      result = 'draw'
    } else if (op.health === 0) {
      playSFX('game_win')
      result = 'win'
    } else {
      playSFX('game_lose')
      result = 'lose'
    }
    ctx.ui.showEndScreen({ result, names: [me.name, op.name], rounds })
    ctx.ui.enablePlayer(true)
    this.setState(GameState.END_SCREEN)
  }

  exitGame() {
    playSFX('warning')
    ctx.ui.popup(
      'Resume',
      () => {},
      'Exit',
      () => this.returnToCustomization(),
      'Quit curent game?',
      'This will return you to the deck customization menu.',
    )
  }

  // Returns the client to the deck customization screen
  returnToCustomization() {
    this.reset()
    ctx.me.reset()
    ctx.op.reset()
    ctx.ui.onCustomizationOpened()
    ctx.ui.hideEndScreen()
    ctx.ui.showCustomization()
    playSFX('menu_opening')
    this.setState(GameState.CUSTOMIZE)
  }

  newOpponentGame() {
    this.reset()
    ctx.me.reset()
    if (this.newOpponentFactory) ctx.op = this.newOpponentFactory()
    ctx.ui.hideEndScreen()
    this.startGame()
  }

  // Restarts the last game with the same decks
  rematchGame() {
    this.reset()
    ctx.me.reset()
    ctx.op.reset()
    ctx.ui.hideEndScreen()
    this.startGame()
  }

  // Executes effects in list. If effect returns true, effect is removed.
  async runEffects(effects: Effect[]) {
    for (let i = effects.length - 1; i >= 0; --i) {
      const effect = effects[i]
      if (await effect()) effects.splice(i, 1)
    }
  }
}
