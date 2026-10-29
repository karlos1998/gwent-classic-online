// Runtime singletons (the original used globals: game, board, weather, player_me, player_op, ui).
import { reactive } from 'vue'
// The engine talks to the presentation layer only through the UIPort interface below,
// which keeps the rules independent from Vue/DOM (and later lets us swap in a network layer).
import type { Card } from './card'
import type { CardContainer, Row } from './containers'
import type { Board } from './board'
import type { Weather } from './containers'
import type { Game } from './game'
import type { Player } from './player'

export type CarouselAction = (container: CardContainer, index: number) => unknown

export interface EndScreenData {
  result: 'win' | 'lose' | 'draw'
  names: [string, string]
  rounds: { me: number; op: number; meWon: boolean; opWon: boolean }[]
}

/** All strings passed to the UI (popup texts, carousel titles, notification names) are i18n keys. */
export interface UIPort {
  enablePlayer(enable: boolean): void
  notification(name: string, duration?: number): Promise<void>
  popup(
    yesName: string,
    yes: () => void,
    noName: string,
    no: () => void,
    title: string,
    description: string,
    alpha?: number,
  ): Promise<void>
  queueCarousel(
    container: CardContainer,
    count: number,
    action: CarouselAction,
    predicate?: (c: Card) => boolean,
    bSort?: boolean,
    bQuit?: boolean,
    title?: string,
  ): Promise<void>
  viewCardsInContainer(container: CardContainer, action?: CarouselAction): Promise<void>
  viewCard(card: Card | null, action?: CarouselAction): Promise<void>
  /** Equivalent of Carousel.curr.cancel() */
  carouselCancel(): void
  /** Equivalent of Carousel.curr.exit() */
  carouselExit(): void
  showPreviewVisuals(card: Card): void
  hidePreview(): void
  waitForRowSelection(card: Card): Promise<Row | null>
  /** Animates a card from one container to another (visual only) */
  translateTo(card: Card, source: CardContainer | null | undefined, dest: CardContainer): Promise<void>
  setPassEnabled(enable: boolean): void
  showEndScreen(data: EndScreenData): void
  hideEndScreen(): void
  showCustomization(): void
  onGameOpened(): void
  onCustomizationOpened(): void
}

export interface AudioPort {
  playSFX(key: string, waitTime?: number, forceWait?: boolean): Promise<void>
}

// Reactive so the UI notices when players are (re)created (ctx.me = new Player(...))
export const ctx = reactive({
  game: null as unknown as Game,
  board: null as unknown as Board,
  weather: null as unknown as Weather,
  me: null as unknown as Player,
  op: null as unknown as Player,
  ui: null as unknown as UIPort,
  audio: { playSFX: async () => {} } as AudioPort,
}) as {
  game: Game
  board: Board
  weather: Weather
  me: Player
  op: Player
  ui: UIPort
  audio: AudioPort
}

export function playSFX(key: string | undefined, waitTime = -1, forceWait = false) {
  if (!key) return Promise.resolve()
  return ctx.audio.playSFX(key, waitTime, forceWait)
}
