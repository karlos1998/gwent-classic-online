// Presentation layer state + logic - port of the original UI, Carousel and Popup classes.
// Implements the engine's UIPort. Everything is reactive; Vue components just render it.
import { reactive } from 'vue'
import {
  ctx,
  ControllerAI,
  CardContainer,
  fadeIn,
  fadeOut,
  sleep,
  sleepUntil,
  type Card,
  type Row,
  type Weather,
  Card as CardClass,
} from '@/engine'
import type { CarouselAction, EndScreenData, UIPort } from '@/engine/context'
import type { Fadeable } from '@/engine/util'
import { ability_dict } from '@/engine/abilities'
import { AudioManager } from './audio'
import { Settings } from './settings'
import { translateTo } from './flight'
import { iconURL } from './assets'
import { t, te, factionName, factionDescription } from '@/i18n'

/** Anything that can be shown in a carousel (cards, or the faction pseudo-cards of the deck maker) */
export interface CarouselItem {
  faction: string
  filename: string
  name?: string
  basePower?: number
  hero?: boolean
  row?: string
  abilities: string[]
}

export interface Description {
  hidden: boolean
  icon: string
  title: string
  text: string
}

const abilityName = (key: string) => (te(`abilities.${key}.name`) ? t(`abilities.${key}.name`) : '')
const abilityDesc = (key: string) => (te(`abilities.${key}.description`) ? t(`abilities.${key}.description`) : '')

// Sets up description window for a card (original UI.setDescription + Card desc_name/desc, now translated)
export function describe(card: CarouselItem | null | undefined): Description {
  if (!card) return { hidden: false, icon: '', title: '', text: '' }
  if (card.faction === 'faction')
    return { hidden: false, icon: '', title: factionName(card.filename), text: factionDescription(card.filename) }
  if (card.hero || card.row === 'agile' || card.abilities.length > 0) {
    let str = card.row === 'agile' ? 'agile' : ''
    if (card.abilities.length) str = card.abilities[card.abilities.length - 1]
    if (str === 'cerys') str = 'muster'
    if (str.startsWith('avenger')) str = 'avenger'
    if (str === 'scorch_c' || str == 'scorch_r' || str === 'scorch_s') str = 'scorch'
    let icon = ''
    if (card.row === 'leader' || (card.abilities.length === 0 && card.row !== 'agile')) icon = ''
    else icon = iconURL('card_ability_' + str)

    let title = ''
    if (card.row === 'leader') title = t('game.leaderAbility')
    else if (card.abilities.length > 0) title = abilityName(card.abilities[card.abilities.length - 1])
    else if (card.row === 'agile') title = abilityName('agile')
    else if (card.hero) title = abilityName('hero')

    let text = card.row === 'agile' ? abilityDesc('agile') : ''
    for (let i = card.abilities.length - 1; i >= 0; --i) text += abilityDesc(card.abilities[i])
    if (card.hero) text += abilityDesc('hero')
    return { hidden: false, icon, title, text }
  }
  return { hidden: true, icon: '', title: '', text: '' }
}

/**
 * Online mode: player input is sent to the server instead of being executed by the local engine.
 * While set, the board's click handlers call these instead of moving cards themselves.
 */
export interface RemoteActions {
  /** a card from the hand dropped on a row / the weather slot (Scorch: row is ignored) */
  playCard(card: Card, row: Row | Weather): void
  playDecoy(decoy: Card, target: Card): void
  pass(): void
  activateLeader(): void
}

type Listener<T> = (arg: T) => void
class Signal<T> {
  private listeners = new Set<Listener<T>>()
  bind(l: Listener<T>) {
    this.listeners.add(l)
  }
  unbind(l: Listener<T>) {
    this.listeners.delete(l)
  }
  dispatch(arg: T) {
    ;[...this.listeners].forEach((l) => l(arg))
  }
}

// Displays up to 5 cards for the client to cycle through and select to perform an action
// Clicking the middle card performs the action on that card "count" times
// Clicking adjacent cards shifts the menu to focus on that card
export class Carousel {
  valid = false
  container!: CardContainer
  count = 0
  action!: CarouselAction
  predicate?: (c: Card) => boolean
  bSort?: boolean
  indices: number[] = []
  index = 0
  bExit = false
  title?: string
  cancelled = false
  /** called when the player closes an exitable carousel (online: answers the open prompt) */
  onCancel?: () => void

  constructor(
    container: CardContainer,
    count: number,
    action: CarouselAction | undefined,
    predicate?: (c: Card) => boolean,
    bSort?: boolean,
    bExit = false,
    title?: string,
  ) {
    const self = reactive(this) as unknown as Carousel
    if (count <= 0 || !container || !action || container.cards.length === 0) return self
    self.valid = true
    self.container = container
    self.count = count
    self.action = action
    self.predicate = predicate
    self.bSort = bSort
    self.bExit = bExit
    self.title = title
    ui.carouselView.transTime = '0.25s'
    return self
  }

  private computeIndices() {
    return this.container.cards.reduce<number[]>((a, c, i) => (!this.predicate || this.predicate(c) ? a.concat([i]) : a), [])
  }

  // Initializes the current Carousel
  start() {
    if (!this.valid) return
    this.indices = this.computeIndices()
    if (this.indices.length <= 0) return this.exit()
    if (this.bSort) this.indices.sort((a, b) => CardClass.compare(this.container.cards[a], this.container.cards[b]))

    this.update()
    ui.carouselCurr = this
    AudioManager.playSFX('open')
    ui.carouselView.visible = true
    ui.enablePlayer(true)
  }

  // Called by the client to cycle cards displayed by n
  shift(n: number) {
    this.index = Math.max(0, Math.min(this.indices.length - 1, this.index + n))
    AudioManager.playSFX('ui_card')
    this.update()
  }

  // called when mousing over/out of one of the carousel cards
  nudge(offset = 0) {
    ui.carouselView.dir = offset < 0 ? 'left' : offset > 0 ? 'right' : ''
    ui.carouselView.magnitude = offset === 2 ? -1 * Math.sign(offset) : -0.6 * offset
  }

  // Called by client to perform action on the middle card in focus
  async select() {
    --this.count
    if (this.isLastSelection()) ui.carouselView.visible = false
    if (this.count <= 0) ui.enablePlayer(false)
    await this.action.call(this, this.container, this.indices[this.index])
    if (this.isLastSelection() && !this.cancelled) return this.exit()
    this.update()
  }

  // Called by client to exit out of the current Carousel if allowed. Enables player interaction.
  cancel() {
    if (this.bExit) {
      this.cancelled = true
      AudioManager.playSFX('discard')
      this.exit()
      this.onCancel?.()
    }
    ui.enablePlayer(true)
  }

  // Returns true if there are no more cards to view or select
  isLastSelection() {
    return this.count <= 0 || this.indices.length === 0
  }

  // Updates the selection of cards (rendering is reactive)
  update() {
    this.indices = this.computeIndices()
    if (this.indices.length <= 0) return this.exit()
    if (this.index >= this.indices.length) this.index = this.indices.length - 1
  }

  /** The 5 visible slots (null = empty) */
  get slots(): (Card | null)[] {
    const out: (Card | null)[] = []
    for (let i = 0; i < 5; i++) {
      const curr = this.index - 2 + i
      out.push(curr >= 0 && curr < this.indices.length ? this.container.cards[this.indices[curr]] : null)
    }
    return out
  }

  get current(): Card | undefined {
    return this.container?.cards[this.indices[this.index]]
  }

  // Clears and quits the current carousel
  exit() {
    ui.carouselView.visible = false
    ui.carouselCurr = null
    ui.quitCarousel()
  }
}

interface PopupState extends Fadeable {
  visible: boolean
  title: string
  description: string
  yesName: string
  noName: string
  alpha: number
  yes: () => void
  no: () => void
}

export class UIStore implements UIPort {
  // main element interaction (original: <main class="noclick">)
  mainNoclick = true
  clickBackgroundActive = false
  leaderMeNoclick = false
  passNoclick = false

  previewCard: Card | null = null
  previewVisible = false
  lastRow: Row | Weather | null = null

  notif: Fadeable & { name: string } = { name: '', opacity: null, hidden: true }

  carousels: Carousel[] = []
  carouselCurr: Carousel | null = null
  carouselView = { visible: false, magnitude: 0, dir: '' as '' | 'left' | 'right', transTime: '0s' }

  /** all texts are i18n keys */
  popupState: PopupState = {
    visible: false,
    title: '',
    description: '',
    yesName: 'popup.yes',
    noName: 'popup.no',
    alpha: 0.95,
    yes: () => {},
    no: () => {},
    opacity: null,
    hidden: true,
  }

  endScreen: Fadeable & { data: EndScreenData | null } = { data: null, opacity: null, hidden: true }
  customizationVisible = true
  /** settings buttons positioned for the deck menu */
  deckMenu = true

  // music (YouTube)
  musicReady = false
  musicPlaying = false

  /** set by the online game, see RemoteActions */
  remote: RemoteActions | null = null

  readonly rowSelected = new Signal<Row | Weather | null>()
  readonly previewCancelled = new Signal<null>()

  constructor() {
    return reactive(this) as UIStore
  }

  // ---------------- UIPort ----------------

  // Enables or disables client interaction
  enablePlayer(enable: boolean) {
    this.mainNoclick = !enable
  }

  setPassEnabled(enable: boolean) {
    this.passNoclick = !enable
  }

  translateTo(card: Card, source: CardContainer | null | undefined, dest: CardContainer) {
    return translateTo(card, source, dest)
  }

  showEndScreen(data: EndScreenData) {
    this.endScreen.data = data
    fadeIn(this.endScreen, 300)
  }

  hideEndScreen() {
    this.endScreen.hidden = true
  }

  showCustomization() {
    this.customizationVisible = true
  }

  onGameOpened() {
    this.deckMenu = false
  }

  onCustomizationOpened() {
    this.deckMenu = true
  }

  // Displays a timed notification to the client
  async notification(name: string, duration?: number) {
    if (!Settings.notifications.isEnabled()) return
    if (!duration) duration = 1200
    const fadeSpeed = 150
    duration = Math.max(400, duration - 2 * fadeSpeed)
    this.notif.name = name
    await fadeIn(this.notif, fadeSpeed)
    await sleep(duration)
    await fadeOut(this.notif, fadeSpeed)
  }

  // Displays a cancellable Carousel for a single card
  async viewCard(card: Card | null, action?: CarouselAction) {
    if (card === null) return
    const container = new CardContainer()
    container.cards.push(card)
    await this.viewCardsInContainer(container, action)
  }

  // Displays a cancellable Carousel for all cards in a container
  async viewCardsInContainer(container: CardContainer, action?: CarouselAction) {
    const act: CarouselAction =
      action ??
      function (this: Carousel) {
        return this.cancel()
      }
    await this.queueCarousel(container, 1, act, () => true, false, true)
  }

  // Displays a Carousel menu of filtered container items that match the predicate.
  // Suspends gameplay until the Carousel is closed. Automatically picks random card if activated for AI player
  async queueCarousel(
    container: CardContainer,
    count: number,
    action: CarouselAction,
    predicate?: (c: Card) => boolean,
    bSort?: boolean,
    bQuit?: boolean,
    title?: string,
  ) {
    if (ctx.game.currPlayer && ctx.game.currPlayer === ctx.op) {
      if (ctx.op.controller instanceof ControllerAI)
        for (let i = 0; i < count; ++i) {
          const cards = container.cards.reduce<number[]>((a, c, i) => (!predicate || predicate(c) ? a.concat([i]) : a), [])
          if (cards.length === 0) break
          await action(container, cards[Math.floor(Math.random() * cards.length)])
        }
      return
    }
    const carousel = new Carousel(container, count, action, predicate, bSort, bQuit, title)
    if (this.carouselCurr === undefined || this.carouselCurr === null) carousel.start()
    else {
      this.carousels.push(carousel)
      return
    }
    await sleepUntil(() => this.carousels.length === 0 && !this.carouselCurr, 100)
  }

  /** Shows (or queues) a prepared carousel without waiting for it - used by the online mode */
  openCarousel(carousel: Carousel) {
    if (!carousel.valid) return
    if (this.carouselCurr) this.carousels.push(carousel)
    else carousel.start()
  }

  /** Closes the given carousel if it is shown or still queued */
  closeCarousel(carousel: Carousel) {
    const queued = this.carousels.indexOf(carousel)
    if (queued >= 0) this.carousels.splice(queued, 1)
    if (this.carouselCurr === carousel) carousel.exit()
  }

  // Starts the next queued Carousel
  quitCarousel() {
    if (this.carousels.length > 0) this.carousels.shift()!.start()
  }

  carouselCancel() {
    this.carouselCurr?.cancel()
  }

  carouselExit() {
    this.carouselCurr?.exit()
  }

  // Displays a custom confirmation menu
  async popup(
    yesName: string,
    yes: () => void,
    noName: string,
    no: () => void,
    title: string,
    description: string,
    alpha = 0.95,
  ) {
    const p = this.popupState
    p.yes = yes ?? (() => {})
    p.no = no ?? (() => {})
    p.title = title ? title : ''
    p.description = description ? description : ''
    p.yesName = yesName ? yesName : 'popup.yes'
    p.noName = noName ? noName : 'popup.no'
    p.alpha = alpha
    p.visible = true
    this.enablePlayer(true)
    await sleepUntil(() => !this.popupState.visible)
  }

  popupSelect(yes: boolean) {
    const p = this.popupState
    this.enablePlayer(false)
    p.visible = false
    if (yes) p.yes()
    else p.no()
  }

  // Sets up the graphics and description for a card preview
  showPreviewVisuals(card: Card) {
    this.previewCard = card
    this.previewVisible = true
  }

  // Hides the card preview then disables and removes highlighting from card destinations
  hidePreview() {
    this.clickBackgroundActive = false
    ctx.me?.hand.cards.forEach((c) => (c.noclick = false))
    this.leaderMeNoclick = false
    this.passNoclick = false

    this.previewVisible = false
    this.setSelectable(null, false)
    this.previewCard = null
    this.lastRow = null
  }

  // used to handle row selection when restoring agile units via medics
  async waitForRowSelection(card: Card): Promise<Row | null> {
    ctx.game.placedEffectsActive = true
    this.setSelectable(null, false)
    this.showPreview(card, false)
    this.enablePlayer(true)
    let selectedRow: Row | null = null
    let bRowSelected = false
    const rowSelect = (row: Row | Weather | null) => {
      bRowSelected = true
      selectedRow = (row as Row) ?? null
    }
    this.rowSelected.bind(rowSelect)
    this.previewCancelled.bind(rowSelect)
    await sleepUntil(() => bRowSelected === true)
    this.rowSelected.unbind(rowSelect)
    this.previewCancelled.unbind(rowSelect)
    this.hidePreview()
    ctx.game.placedEffectsActive = false
    return selectedRow
  }

  // ---------------- client input ----------------

  // Called when the player selects a selectable card
  async selectCard(card: Card) {
    const row = this.lastRow
    const pCard = this.previewCard
    if (card === pCard) return
    if (pCard === null || card.holder!.hand.cards.includes(card)) {
      this.setSelectable(null, false)
      this.showPreview(card)
    } else if (pCard.name === 'Decoy') {
      this.hidePreview()
      this.enablePlayer(false)
      if (this.remote) return this.remote.playDecoy(pCard, card)
      ctx.board.toHand(card, row!)
      await ctx.board.moveTo(pCard, row!, pCard.holder!.hand)
      pCard.holder!.endTurn()
    }
  }

  // Called when the player selects a selectable CardContainer
  async selectRow(row: Row | Weather) {
    this.rowSelected.dispatch(row)
    if (ctx.game.placedEffectsActive) return
    this.lastRow = row
    if (this.previewCard === null) {
      await this.viewCardsInContainer(row)
      return
    }
    if (this.previewCard.name === 'Decoy') return
    const card = this.previewCard
    const holder = card.holder!
    this.hidePreview()
    this.enablePlayer(false)
    if (this.remote) return this.remote.playCard(card, row)
    if (card.name === 'Scorch') {
      this.hidePreview()
      await ability_dict['scorch'].activated!(card)
    } else if (card.name === 'Decoy') {
      return
    } else {
      await ctx.board.moveTo(card, row, card.holder!.hand)
    }
    holder.endTurn()
  }

  // Called when the client cancels out of a card-preview
  cancel() {
    this.hidePreview()
    this.previewCancelled.dispatch(null)
  }

  passRound() {
    if (this.remote) {
      this.setPassEnabled(false)
      this.enablePlayer(false)
      return this.remote.pass()
    }
    ctx.me.passRound()
    AudioManager.playSFX('pass')
  }

  clickLeader(isMe: boolean) {
    const player = isMe ? ctx.me : ctx.op
    if (!player) return
    if (player.leaderPlayable)
      this.viewCard(player.leader, async () => {
        AudioManager.playSFX('open')
        if (this.remote) {
          this.enablePlayer(false)
          return this.remote.activateLeader()
        }
        await player.activateLeader()
      })
    else this.viewCard(player.leader)
  }

  // Displays a card preview then enables and highlights potential card destinations
  showPreview(card: Card, allowClose = true) {
    this.showPreviewVisuals(card)
    this.setSelectable(card, true)
    AudioManager.playSFX('open')
    if (allowClose) {
      this.clickBackgroundActive = true
    } else {
      this.leaderMeNoclick = true
      this.passNoclick = true
      ctx.me.hand.cards.forEach((c) => (c.noclick = true))
    }
  }

  // Enables or disables selection and highlighting of rows specific to the card
  setSelectable(card: Card | null, enable: boolean) {
    const board = ctx.board
    const weather = ctx.weather
    if (!enable || !card) {
      for (const row of board.row) {
        row.ui.selectable = false
        row.ui.noclick = false
        row.ui.specialSelectable = false
        row.ui.specialNoclick = false
        row.ui.cardSelectable = true
        for (const c of row.cards) c.noclick = true
      }
      weather.ui.selectable = false
      weather.ui.noclick = false
      return
    }
    if (card.faction === 'weather') {
      for (const row of board.row) {
        row.ui.noclick = true
        row.ui.specialNoclick = true
      }
      weather.ui.selectable = true
      return
    }

    weather.ui.noclick = true

    if (card.name === 'Scorch') {
      for (const r of board.row) {
        r.ui.selectable = true
        r.ui.specialSelectable = true
      }
      return
    }
    if (card.isSpecial()) {
      for (let i = 0; i < 6; i++) {
        const r = board.row[i]
        if (i < 3 || r.special !== null) {
          r.ui.noclick = true
          r.ui.specialNoclick = true
        } else {
          r.ui.specialSelectable = true
        }
      }
      return
    }

    board.row.forEach((r) => (r.ui.specialNoclick = true))

    if (card.name === 'Decoy') {
      for (let i = 0; i < 6; ++i) {
        const r = board.row[i]
        const units = r.cards.filter((c) => c.isUnit())
        if (i < 3 || units.length === 0) {
          r.ui.noclick = true
          r.ui.specialNoclick = true
          r.ui.cardSelectable = false
        } else {
          r.ui.selectable = true
          units.forEach((c) => (c.noclick = false))
        }
      }
      return
    }

    const currRows =
      card.row === 'agile'
        ? [board.getRow(card, 'close', card.holder), board.getRow(card, 'ranged', card.holder)]
        : [board.getRow(card, card.row, card.holder)]
    for (let i = 0; i < 6; i++) {
      const row = board.row[i]
      if (currRows.includes(row)) row.ui.selectable = true
      else row.ui.noclick = true
    }
  }

  // ---------------- settings ----------------

  toggleNotifications() {
    Settings.notifications.toggle()
  }

  toggleSFX() {
    Settings.soundEffects.toggle()
  }

  // Called when client toggles the music
  toggleMusic() {
    const isPlaying = music.isPlaying()
    if (isPlaying) music.pause()
    else music.play()
    this.musicPlaying = !isPlaying
    Settings.music.setEnabled(!isPlaying)
  }
}

// ---------------- background music (YouTube, same track as the original) ----------------
interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  getPlayerState(): number
}
declare global {
  interface Window {
    YT?: { Player: new (id: string, opts: unknown) => YTPlayer; PlayerState: { PLAYING: number } }
    onYouTubeIframeAPIReady?: () => void
  }
}

const music = {
  player: null as YTPlayer | null,
  active: undefined as boolean | undefined,
  isPlaying() {
    return !!this.player && !!window.YT && this.player.getPlayerState() === window.YT.PlayerState.PLAYING
  },
  play() {
    this.player?.playVideo()
  },
  pause() {
    this.player?.pauseVideo()
  },
  init() {
    if (typeof window === 'undefined' || document.getElementById('yt-api')) return
    window.onYouTubeIframeAPIReady = () => {
      music.player = new window.YT!.Player('youtube', {
        videoId: 'UE9fPWy1_o4',
        playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: 'UE9fPWy1_o4', rel: 0, version: 3, modestbranding: 1 },
        events: { onStateChange: initButton },
      })
    }
    const s = document.createElement('script')
    s.id = 'yt-api'
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)

    function initButton() {
      if (music.active !== undefined) return
      music.active = true
      music.play()
      const timer = setInterval(() => {
        if (!music.isPlaying()) music.play()
        else {
          clearInterval(timer)
          ui.musicReady = true
          ui.musicPlaying = true
          if (!Settings.music.isEnabled()) setTimeout(() => ui.toggleMusic(), 10)
        }
      }, 500)
    }
  },
}

export const ui = new UIStore()
export const initMusic = () => music.init()
