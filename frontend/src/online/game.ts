// Client side of a running online game: plays the server's messages on the shared board.
// Messages are processed strictly in order; card flights are awaited so the next snapshot never
// overtakes an animation. If the client falls behind (background tab, slow device) animations are
// skipped until it has caught up again, so both players always see the same moment of the game.
import { reactive } from 'vue'
import { Card, CardContainer, ctx, type Row, type Weather } from '@/engine'
import { Carousel, ui, type RemoteActions } from '@/ui/store'
import { AudioManager } from '@/ui/audio'
import { ensureEngine } from '@/ui/bootstrap'
import { BoardMirror } from './mirror'
import { BOARD_SLOTS, type ClientMessage, type Fx, type Prompt, type ServerMessage, type Side } from './protocol'

/** Messages older than this are applied without animation */
const MAX_LAG_MS = 1500

export interface TurnTimer {
  owner: Side
  /** both players act at the same time (mulligan) */
  simultaneous: boolean
  timeoutMs: number
  /** performance.now() based */
  endsAt: number
}

export interface GameOverInfo {
  result: 'win' | 'lose' | 'draw'
  reason: string | null
}

type GameMessage = Extract<
  ServerMessage,
  { type: 'state' | 'fx' | 'prompt' | 'promptClosed' | 'timer' | 'opponentConnection' | 'gameOver' }
>

export class OnlineGame {
  /** reactive view state for the overlay components */
  readonly view = reactive({
    timer: null as TurnTimer | null,
    opponentAway: null as { endsAt: number } | null,
    over: null as GameOverInfo | null,
  })

  private readonly mirror = new BoardMirror()
  private readonly queue: { msg: GameMessage; at: number }[] = []
  private pumping = false
  private disposed = false
  private prompt: Prompt | null = null
  private carousel: Carousel | null = null
  private rowChoice: ((row: Row | Weather | null) => void) | null = null
  private promptWaiters: (() => void)[] = []

  constructor(
    private readonly send: (msg: ClientMessage) => boolean,
    /** buttons of the end screen (search again / back to the lobby) */
    private readonly endActions: () => { label: string; run: () => void }[],
  ) {}

  start() {
    ensureEngine()
    ctx.game.reset()
    ctx.me = null as never
    ctx.op = null as never
    ui.hideEndScreen()
    ui.hidePreview()
    ui.customizationVisible = false
    ui.onGameOpened()
    ui.remote = this.remote
    ui.enablePlayer(false)
    ui.setPassEnabled(false)
  }

  /** Leaves the board in the same clean state the offline mode expects */
  dispose() {
    this.disposed = true
    this.queue.length = 0
    this.closePromptUi()
    if (ui.remote === this.remote) ui.remote = null
    ctx.game.reset()
    ctx.me = null as never
    ctx.op = null as never
    ui.hideEndScreen()
    ui.hidePreview()
    ui.enablePlayer(false)
    ui.customizationVisible = true
    ui.onCustomizationOpened()
  }

  handle(msg: GameMessage) {
    if (this.disposed) return
    this.queue.push({ msg, at: performance.now() })
    void this.pump()
  }

  surrender() {
    this.send({ type: 'surrender' })
  }

  // ------------------------------------------------------------------ message loop

  private async pump() {
    if (this.pumping) return
    this.pumping = true
    try {
      while (this.queue.length && !this.disposed) {
        const { msg, at } = this.queue.shift()!
        try {
          await this.process(msg, at)
        } catch (e) {
          if ((e as Error)?.name !== 'GameAborted') console.error('online: failed to process', msg.type, e)
        }
      }
    } finally {
      this.pumping = false
    }
  }

  private async process(msg: GameMessage, at: number) {
    const lagging = performance.now() - at > MAX_LAG_MS || document.hidden
    switch (msg.type) {
      case 'state': {
        const animate = !lagging && this.prompt?.kind !== 'MULLIGAN'
        await this.mirror.apply(msg.snapshot, animate, (m) => ui.translateTo(m.card, m.from, m.to))
        return
      }
      case 'fx':
        return this.effect(msg.effect, lagging)
      case 'prompt':
        return this.openPrompt(msg.prompt)
      case 'promptClosed':
        if (this.prompt?.promptId === msg.promptId) {
          this.prompt = null
          this.closePromptUi()
        }
        this.releasePromptWaiters()
        return
      case 'timer':
        this.view.timer = msg.owner
          ? {
              owner: msg.owner,
              simultaneous: this.prompt?.kind === 'MULLIGAN',
              timeoutMs: msg.timeoutMs,
              endsAt: at + msg.remainingMs,
            }
          : null
        return
      case 'opponentConnection':
        this.view.opponentAway = msg.connected ? null : { endsAt: at + msg.graceMs }
        return
      case 'gameOver':
        return this.gameOver(msg)
    }
  }

  // ------------------------------------------------------------------ effects

  private effect(fx: Fx, lagging: boolean) {
    switch (fx.kind) {
      case 'notification':
        if (!lagging) void ui.notification(fx.key, 1200)
        return
      case 'sound':
        if (!lagging) void AudioManager.playSFX(fx.key)
        return
      case 'animation': {
        const card = this.mirror.find(fx.cardId)
        if (card && !lagging) void card.animate(fx.animation)
        return
      }
      case 'preview': {
        if (lagging) return
        const card = this.mirror.card(fx.card, 'op')
        ui.showPreviewVisuals(card)
        setTimeout(() => {
          if (ui.previewCard === card) ui.hidePreview()
        }, fx.durationMs)
        return
      }
      case 'reveal': {
        // Emhyr "Emperor of Nilfgaard": the server sends exactly the 3 revealed cards, nothing more
        const container = new CardContainer()
        container.cards = fx.cards.map((c) => this.mirror.card(c, 'op'))
        const carousel = new Carousel(container, 1, function (this: Carousel) {
          this.cancel()
        }, () => true, false, true, fx.titleKey)
        ui.openCarousel(carousel)
        return
      }
    }
  }

  // ------------------------------------------------------------------ prompts

  private openPrompt(p: Prompt) {
    this.releasePromptWaiters()
    // the mulligan prompt is refreshed after every swap - keep its carousel open
    if (p.kind === 'MULLIGAN' && this.prompt?.promptId === p.promptId && this.carousel) {
      this.prompt = p
      return
    }
    this.closePromptUi()
    this.prompt = p
    switch (p.kind) {
      case 'TURN':
        ui.enablePlayer(true)
        ui.setPassEnabled(true)
        ctx.me.leaderPlayable = ctx.me.leaderAvailable
        return
      case 'MULLIGAN':
        return this.showCarousel(ctx.me.hand, p.remaining, true, 'carousel.redraw', (card) => {
          this.answer({ type: 'chooseCard', promptId: p.promptId, cardId: this.mirror.idOf(card)! })
          return this.nextPrompt()
        }, () => this.answer({ type: 'finishMulligan', promptId: p.promptId }))
      case 'CHOOSE_CARD': {
        const container = new CardContainer()
        container.cards = p.options.map((c) => this.mirror.card(c, 'me'))
        return this.showCarousel(container, 1, p.cancellable, 'carousel.choice.' + p.choice, (card) => {
          this.answer({ type: 'chooseCard', promptId: p.promptId, cardId: this.mirror.idOf(card)! })
        }, () => this.answer({ type: 'chooseCard', promptId: p.promptId, cardId: null }))
      }
      case 'CHOOSE_ROW':
        return this.chooseRow(p)
      case 'CHOOSE_START':
        void ui.popup(
          'popup.goFirst',
          () => this.answer({ type: 'chooseStart', promptId: p.promptId, start: true }),
          'popup.letOpponentStart',
          () => this.answer({ type: 'chooseStart', promptId: p.promptId, start: false }),
          'popup.scoiataelTitle',
          'popup.scoiataelDescription',
        )
        return
    }
  }

  private showCarousel(
    container: CardContainer,
    count: number,
    cancellable: boolean,
    title: string,
    pick: (card: Card) => unknown,
    cancel: () => void,
  ) {
    const carousel = new Carousel(
      container,
      count,
      async (c, i) => {
        await pick(c.cards[i])
      },
      () => true,
      false,
      cancellable,
      title,
    )
    carousel.onCancel = cancel
    this.carousel = carousel
    ui.openCarousel(carousel)
  }

  /** Agile card revived by a medic / summoned by the Skellige perk: pick close or ranged */
  private chooseRow(p: Prompt) {
    const card = this.mirror.card(p.card!, 'me')
    ctx.game.placedEffectsActive = true
    ui.setSelectable(null, false)
    ui.showPreview(card, false)
    ui.enablePlayer(true)
    const onRow = (row: Row | Weather | null) => {
      const index = row && 'index' in row ? row.index : -1
      if (index !== 3 && index !== 4) return // only own close / ranged
      this.answer({ type: 'chooseRow', promptId: p.promptId, row: index === 3 ? 'close' : 'ranged' })
      this.closePromptUi()
    }
    this.rowChoice = onRow
    ui.rowSelected.bind(onRow)
  }

  private closePromptUi() {
    if (this.carousel) {
      const carousel = this.carousel
      this.carousel = null
      carousel.onCancel = undefined
      ui.closeCarousel(carousel)
    }
    if (this.rowChoice) {
      ui.rowSelected.unbind(this.rowChoice)
      this.rowChoice = null
      ctx.game.placedEffectsActive = false
    }
    if (ui.popupState.visible) ui.popupState.visible = false
    ui.hidePreview()
    ui.setPassEnabled(false)
    ui.enablePlayer(false)
    if (ctx.me) ctx.me.leaderPlayable = false
  }

  private answer(msg: ClientMessage) {
    if (!this.send(msg)) this.reopenTurn()
  }

  /** The server rejected an action (or it could not be sent): let the player try again */
  reopenTurn() {
    if (this.prompt?.kind !== 'TURN') return
    ui.enablePlayer(true)
    ui.setPassEnabled(true)
    ctx.me.leaderPlayable = ctx.me.leaderAvailable
  }

  /** Resolves when the server answered the last mulligan swap (refreshed or closed prompt) */
  private nextPrompt() {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 3000)
      this.promptWaiters.push(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  private releasePromptWaiters() {
    const waiters = this.promptWaiters
    this.promptWaiters = []
    waiters.forEach((w) => w())
  }

  // ------------------------------------------------------------------ input from the board

  private readonly remote: RemoteActions = {
    playCard: (card: Card, row: Row | Weather) => {
      const p = this.prompt
      if (p?.kind !== 'TURN') return
      const cardId = this.mirror.idOf(card)!
      const slot =
        card.name === 'Scorch' ? null : row === ctx.weather ? 'WEATHER' : BOARD_SLOTS[(row as Row).index] ?? null
      this.answer({ type: 'playCard', promptId: p.promptId, cardId, slot, targetCardId: null })
    },
    playDecoy: (decoy: Card, target: Card) => {
      const p = this.prompt
      if (p?.kind !== 'TURN') return
      this.answer({
        type: 'playCard',
        promptId: p.promptId,
        cardId: this.mirror.idOf(decoy)!,
        slot: null,
        targetCardId: this.mirror.idOf(target)!,
      })
    },
    pass: () => {
      const p = this.prompt
      if (p?.kind === 'TURN') this.answer({ type: 'pass', promptId: p.promptId })
    },
    activateLeader: () => {
      const p = this.prompt
      if (p?.kind === 'TURN') this.answer({ type: 'activateLeader', promptId: p.promptId })
    },
  }

  // ------------------------------------------------------------------ end

  private gameOver(msg: Extract<ServerMessage, { type: 'gameOver' }>) {
    this.prompt = null
    this.closePromptUi()
    this.view.timer = null
    this.view.opponentAway = null
    this.view.over = { result: msg.result, reason: msg.reason }
    const rounds = [0, 1, 2].map((i) => {
      const r = msg.rounds[i]
      return {
        me: r ? r.self : 0,
        op: r ? r.opponent : 0,
        meWon: !!r && r.winner === 'SELF',
        opWon: !!r && r.winner === 'OPPONENT',
      }
    })
    const message =
      msg.reason === 'surrender'
        ? msg.result === 'win' ? 'online.end.opponentSurrendered' : 'online.end.youSurrendered'
        : msg.reason === 'disconnect'
          ? msg.result === 'win' ? 'online.end.opponentLeft' : 'online.end.youLeft'
          : msg.reason === 'server_shutdown'
            ? 'online.end.serverShutdown'
            : undefined
    ui.showEndScreen({
      result: msg.result,
      names: [ctx.me?.name ?? '', ctx.op?.name ?? ''],
      rounds,
      message,
      actions: this.endActions(),
    })
    ui.enablePlayer(true)
  }
}
