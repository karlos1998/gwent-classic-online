// Mirrors server snapshots into the engine objects the board components already render
// (ctx.board rows, ctx.weather, ctx.me / ctx.op). No rules run on the client: every value comes from
// the server, the client only animates the difference between two snapshots.
//
// Hidden information stays hidden: the opponent's hand and both decks arrive as counts only, so
// those containers are filled with anonymous placeholder cards that are never shown face up.
import { toRaw } from 'vue'
import {
  Card,
  CardContainer,
  ctx,
  fadeIn,
  fadeOut,
  Player,
  card_dict,
  type DeckData,
  type Row,
} from '@/engine'
import type { CardDto, GameSnapshot, PlayerView, RowDto } from './protocol'

type Side = 'me' | 'op'

/** where a visible card is: hand-me, grave-me, grave-op, row-<i>, special-<i>, weather, leader-<side> */
type Location = string

const WEATHER_OVERLAY: Record<RowDto['type'], string> = { close: 'frost', ranged: 'fog', siege: 'rain' }

/** any card works as a face-down placeholder, it is only ever rendered as a card back */
const PLACEHOLDER = card_dict.findIndex((c) => c.deck === 'neutral' && c.row !== 'leader')

interface Movement {
  card: Card
  from: CardContainer | null
  to: CardContainer
}

export class BoardMirror {
  private readonly cards = new Map<number, Card>()
  /** keyed by the raw card: Vue proxies of the same card must map to the same id */
  private readonly ids = new WeakMap<object, number>()
  private location = new Map<number, Location>()
  private readonly weatherOn: boolean[] = [false, false, false, false, false, false]
  private last: GameSnapshot | null = null

  /** Server id of a mirrored card (for commands) */
  idOf(card: Card): number | undefined {
    return this.ids.get(toRaw(card))
  }

  /** Already known card */
  find(id: number): Card | undefined {
    return this.cards.get(id)
  }

  /** Card object for a server card, created on first sight */
  card(dto: CardDto, holder: Side): Card {
    let card = this.cards.get(dto.id)
    if (!card) {
      card = new Card(card_dict[dto.index], holder === 'me' ? ctx.me : ctx.op)
      this.cards.set(dto.id, card)
      this.ids.set(toRaw(card), dto.id)
    }
    if (card.name !== 'Decoy') card.power = dto.power
    return card
  }

  /** Builds the two players from the first snapshot of a game */
  private createPlayers(snap: GameSnapshot) {
    const deck = (view: PlayerView): DeckData => ({ faction: view.faction, leader: card_dict[view.leader.index], cards: [] })
    ctx.me = new Player(0, snap.self.profile.nickname, deck(snap.self))
    ctx.op = new Player(1, snap.opponent.profile.nickname, deck(snap.opponent))
    for (const [side, view] of [['me', snap.self], ['op', snap.opponent]] as const) {
      const player = side === 'me' ? ctx.me : ctx.op
      this.cards.set(view.leader.id, player.leader)
      this.ids.set(toRaw(player.leader), view.leader.id)
      this.location.set(view.leader.id, 'leader-' + side)
    }
  }

  /**
   * Applies a snapshot. With {@code animate} the cards that changed place fly to their new container first
   * (same ghost animation as offline), then the whole state is set at once.
   */
  async apply(snap: GameSnapshot, animate: boolean, fly: (m: Movement) => Promise<void>) {
    if (this.last && snap.version <= this.last.version) return
    if (!this.last) this.createPlayers(snap)
    const prev = this.last
    this.last = snap

    const target = this.layout(snap)
    if (animate && prev) {
      const moves = this.movements(prev, snap, target)
      if (moves.length) await Promise.all(moves.map(fly))
    }
    this.commit(snap, target)
  }

  // ------------------------------------------------------------------ diff

  private layout(snap: GameSnapshot): Map<number, { loc: Location; dto: CardDto; side: Side }> {
    const out = new Map<number, { loc: Location; dto: CardDto; side: Side }>()
    const put = (dto: CardDto | null, loc: Location, side: Side) => dto && out.set(dto.id, { loc, dto, side })
    snap.self.hand?.forEach((c) => put(c, 'hand-me', 'me'))
    snap.self.grave.forEach((c) => put(c, 'grave-me', 'me'))
    snap.opponent.grave.forEach((c) => put(c, 'grave-op', 'op'))
    snap.rows.forEach((row, i) => {
      const side: Side = i < 3 ? 'op' : 'me'
      row.cards.forEach((c) => put(c, 'row-' + i, side))
      put(row.special, 'special-' + i, side)
    })
    snap.weather.forEach((c) => put(c, 'weather', 'me'))
    put(snap.self.leader, 'leader-me', 'me')
    put(snap.opponent.leader, 'leader-op', 'op')
    return out
  }

  private container(loc: Location): CardContainer {
    if (loc === 'hand-me') return ctx.me.hand
    if (loc === 'grave-me') return ctx.me.grave
    if (loc === 'grave-op') return ctx.op.grave
    if (loc === 'weather') return ctx.weather
    const [kind, index] = loc.split('-')
    if (kind === 'row' || kind === 'special') return ctx.board.row[Number(index)]
    return ctx.me.hand
  }

  private movements(prev: GameSnapshot, snap: GameSnapshot, target: Map<number, { loc: Location; dto: CardDto; side: Side }>) {
    // hidden zones: how many cards left / entered them since the last snapshot
    const budget = {
      meDeck: prev.self.deckCount - snap.self.deckCount,
      opHand: prev.opponent.handCount - snap.opponent.handCount,
      opDeck: prev.opponent.deckCount - snap.opponent.deckCount,
    }
    const take = (key: keyof typeof budget, container: CardContainer) => {
      if (budget[key] <= 0) return null
      budget[key]--
      return container
    }
    const hiddenSource = (loc: Location, side: Side): CardContainer | null => {
      if (loc === 'hand-me') return take('meDeck', ctx.me.deck)
      return side === 'me'
        ? take('meDeck', ctx.me.deck) ?? take('opHand', ctx.op.hand) ?? take('opDeck', ctx.op.deck)
        : take('opHand', ctx.op.hand) ?? take('opDeck', ctx.op.deck) ?? take('meDeck', ctx.me.deck)
    }

    const moves: Movement[] = []
    for (const [id, t] of target) {
      if (t.loc.startsWith('leader-')) continue
      const was = this.location.get(id)
      if (was === t.loc) continue
      const card = this.card(t.dto, t.side)
      const from = was ? this.container(was) : hiddenSource(t.loc, t.side)
      if (from) moves.push({ card, from, to: this.container(t.loc) })
    }
    // visible cards that went into a hidden zone (decoy back to the opponent's hand, mulligan ...)
    for (const [id, was] of this.location) {
      if (target.has(id) || was.startsWith('leader-')) continue
      const card = this.cards.get(id)!
      const to =
        card.holder === ctx.op
          ? snap.opponent.handCount > prev.opponent.handCount
            ? ctx.op.hand
            : snap.opponent.deckCount > prev.opponent.deckCount
              ? ctx.op.deck
              : null
          : snap.self.deckCount > prev.self.deckCount
            ? ctx.me.deck
            : null
      if (to) moves.push({ card, from: this.container(was), to })
    }
    return moves
  }

  // ------------------------------------------------------------------ commit

  private commit(snap: GameSnapshot, target: Map<number, { loc: Location; dto: CardDto; side: Side }>) {
    const me = ctx.me
    const op = ctx.op
    const cards = (list: CardDto[] | null | undefined, side: Side) => (list ?? []).map((c) => this.card(c, side))

    // hand: rendered sorted by the board, keep it sorted here too (carousels index into it)
    const hand = cards(snap.self.hand, 'me').sort(Card.compare)
    hand.forEach((c) => (c.noclick = false))
    me.hand.cards = hand
    me.grave.cards = cards(snap.self.grave, 'me')
    op.grave.cards = cards(snap.opponent.grave, 'op')
    // hands and graves reveal the real owner (a spy lies on the other side of the board)
    for (const c of [...hand, ...me.grave.cards]) c.holder = me
    for (const c of op.grave.cards) c.holder = op

    snap.rows.forEach((dto, i) => {
      const row = ctx.board.row[i]
      const side: Side = i < 3 ? 'op' : 'me'
      const list = cards(dto.cards, side)
      list.forEach((c) => (c.noclick = true))
      row.cards = list
      row.special = dto.special ? this.card(dto.special, side) : null
      if (row.special) row.special.noclick = true
      row.total = dto.total
      this.setWeather(row, i, dto)
    })
    const weather = cards(snap.weather, 'me')
    weather.forEach((c) => (c.noclick = true))
    ctx.weather.cards = weather

    fillHidden(me.deck, snap.self.deckCount)
    fillHidden(op.deck, snap.opponent.deckCount)
    fillHidden(op.hand, snap.opponent.handCount)

    applyPlayer(me, snap.self, snap.turn === 'SELF')
    applyPlayer(op, snap.opponent, snap.turn === 'OPPONENT')

    const location = new Map<number, Location>()
    for (const [id, t] of target) location.set(id, t.loc)
    this.location = location
  }

  private setWeather(row: Row, index: number, dto: RowDto) {
    if (this.weatherOn[index] === dto.weather) return
    this.weatherOn[index] = dto.weather
    const overlay = WEATHER_OVERLAY[dto.type]
    if (dto.weather) {
      row.overlay.cls = overlay
      fadeIn(row.overlay, 500)
    } else {
      fadeOut(row.overlay, 500).then(() => {
        if (!this.weatherOn[index] && row.overlay.cls === overlay) row.overlay.cls = ''
      })
    }
  }
}

function applyPlayer(player: Player, view: PlayerView, isTurn: boolean) {
  player.health = view.health
  player.total = view.total
  player.passed = view.passed
  player.winning = view.winning
  player.isTurn = isTurn
  player.leaderAvailable = view.leaderState === 'AVAILABLE'
  player.leaderFaded = view.leaderState === 'USED'
  player.leaderActiveShown = view.leaderState === 'AVAILABLE' && isTurn
  // the leader becomes playable only while the player has an open turn prompt (see OnlineGame)
  if (view.leaderState !== 'AVAILABLE') player.leaderPlayable = false
}

/** Keeps exactly {@code n} face-down placeholders in a hidden zone */
function fillHidden(container: CardContainer, n: number) {
  if (container.cards.length === n) return
  if (container.cards.length > n) {
    container.cards = container.cards.slice(0, n)
    return
  }
  const extra: Card[] = []
  for (let i = container.cards.length; i < n; i++) extra.push(new Card(card_dict[PLACEHOLDER], null))
  container.cards = [...container.cards, ...extra]
}
