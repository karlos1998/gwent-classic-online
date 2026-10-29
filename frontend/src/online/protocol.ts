// Wire protocol of the Gwent Online server (mirrors com.gwentonline.protocol.* records).
// Keep in sync with the backend - every message is a JSON object with a "type" discriminator.

export type Side = 'SELF' | 'OPPONENT'

export interface PlayerProfile {
  nickname: string
  kind: 'GUEST' | 'ACCOUNT'
  /** only for accounts (planned Google sign-in) */
  avatarUrl: string | null
  gamesPlayed: number | null
}

/** A visible card: id is opaque per game, index points into card_dict */
export interface CardDto {
  id: number
  index: number
  power: number
}

export interface DeckDto {
  faction: string
  leader: number
  cards: { index: number; count: number }[]
}

export type LeaderState = 'AVAILABLE' | 'PASSIVE' | 'USED'

export interface PlayerView {
  profile: PlayerProfile
  faction: string
  leader: CardDto
  leaderState: LeaderState
  health: number
  total: number
  passed: boolean
  winning: boolean
  handCount: number
  deckCount: number
  /** only for the recipient */
  hand: CardDto[] | null
  grave: CardDto[]
}

export interface RowDto {
  type: 'close' | 'ranged' | 'siege'
  total: number
  weather: boolean
  special: CardDto | null
  cards: CardDto[]
}

export interface GameSnapshot {
  version: number
  round: number
  turn: Side | null
  self: PlayerView
  opponent: PlayerView
  /** client order: opponent siege, ranged, close, own close, ranged, siege */
  rows: RowDto[]
  weather: CardDto[]
}

export type ChoiceKind =
  | 'MEDIC_REVIVE'
  | 'LEADER_TAKE_FROM_OPPONENT_GRAVE'
  | 'LEADER_RESTORE_FROM_GRAVE'
  | 'LEADER_DISCARD'
  | 'LEADER_DRAW_FROM_DECK'
  | 'LEADER_WEATHER_FROM_DECK'

export interface Prompt {
  promptId: string
  kind: 'TURN' | 'CHOOSE_CARD' | 'CHOOSE_ROW' | 'CHOOSE_START' | 'MULLIGAN'
  timeoutMs: number
  remainingMs: number
  choice: ChoiceKind | null
  options: CardDto[]
  card: CardDto | null
  cancellable: boolean
  remaining: number
}

export type Fx =
  | { kind: 'notification'; key: string }
  | { kind: 'animation'; cardId: number; animation: string }
  | { kind: 'preview'; card: CardDto; durationMs: number }
  | { kind: 'sound'; key: string }
  | { kind: 'reveal'; cards: CardDto[]; titleKey: string }

export type LobbyStatus = 'IDLE' | 'SEARCHING' | 'MATCH_FOUND' | 'IN_GAME'

export type MatchCancelReason = 'declinedByYou' | 'declinedByOpponent' | 'timeout' | 'opponentLeft' | 'left'

export interface RoundDto {
  self: number
  opponent: number
  winner: Side | null
}

export type ServerMessage =
  | { type: 'welcome'; profile: PlayerProfile; status: LobbyStatus; serverTime: number; turnTimeoutMs: number }
  | { type: 'error'; code: string }
  | { type: 'pong'; serverTime: number }
  | { type: 'searching'; sinceServerTime: number }
  | { type: 'searchCancelled' }
  | { type: 'matchFound'; matchId: string; opponent: PlayerProfile; timeoutMs: number }
  | { type: 'matchUpdate'; matchId: string; youAccepted: boolean; opponentAccepted: boolean }
  | { type: 'matchCancelled'; matchId: string; reason: MatchCancelReason; searchingAgain: boolean }
  | { type: 'gameStarted'; gameId: string; self: PlayerProfile; opponent: PlayerProfile; turnTimeoutMs: number }
  | { type: 'state'; snapshot: GameSnapshot }
  | { type: 'fx'; effect: Fx }
  | { type: 'prompt'; prompt: Prompt }
  | { type: 'promptClosed'; promptId: string }
  | { type: 'timer'; owner: Side | null; timeoutMs: number; remainingMs: number }
  | { type: 'opponentConnection'; connected: boolean; graceMs: number }
  | { type: 'gameOver'; result: 'win' | 'lose' | 'draw'; reason: 'surrender' | 'disconnect' | 'server_shutdown' | null; rounds: RoundDto[] }

/** Board slots relative to the acting player; the ordinal equals the client's board row index */
export const BOARD_SLOTS = [
  'OPPONENT_SIEGE',
  'OPPONENT_RANGED',
  'OPPONENT_CLOSE',
  'OWN_CLOSE',
  'OWN_RANGED',
  'OWN_SIEGE',
] as const
export type BoardSlot = (typeof BOARD_SLOTS)[number] | 'WEATHER'

export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ping' }
  | { type: 'findMatch'; deck: DeckDto }
  | { type: 'cancelSearch' }
  | { type: 'respondMatch'; matchId: string; accept: boolean }
  | { type: 'playCard'; promptId: string; cardId: number; slot: BoardSlot | null; targetCardId: number | null }
  | { type: 'pass'; promptId: string }
  | { type: 'activateLeader'; promptId: string }
  | { type: 'chooseCard'; promptId: string; cardId: number | null }
  | { type: 'chooseRow'; promptId: string; row: 'close' | 'ranged' }
  | { type: 'chooseStart'; promptId: string; start: boolean }
  | { type: 'finishMulligan'; promptId: string }
  | { type: 'surrender' }

/** WebSocket close codes used by the server */
export const CloseCode = {
  REPLACED: 4001,
  AUTH_FAILED: 4003,
  AUTH_TIMEOUT: 4008,
  RATE_LIMITED: 4029,
} as const
