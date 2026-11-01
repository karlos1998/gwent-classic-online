// Online mode state machine: guest session -> lobby (search / match found) -> game.
// One reactive singleton, the views only render it and call its actions.
import { markRaw, reactive } from 'vue'
import { AudioManager } from '@/ui/audio'
import { api, ApiError } from './api'
import { OnlineGame } from './game'
import { GameSocket, type FatalReason, type SocketState } from './socket'
import type { DeckDto, MatchCancelReason, PlayerProfile, ServerMessage } from './protocol'

const TOKEN_KEY = 'gc-online-session'
const TOAST_MS = 4500

export type Phase = 'nickname' | 'connecting' | 'lobby' | 'game' | 'replaced'

export interface PendingMatch {
  id: string
  opponent: PlayerProfile
  timeoutMs: number
  /** performance.now() based */
  endsAt: number
  youAccepted: boolean
  opponentAccepted: boolean
  /** this player answered (accept or decline) */
  responded: boolean
}

export interface Toast {
  id: number
  /** i18n key */
  key: string
  kind: 'info' | 'error'
}

interface StoredSession {
  token: string
  profile: PlayerProfile
}

let toastSeq = 0

/** errors that mean "your action was not accepted, try again" while a turn prompt is open */
const RETRY_ERRORS = /^(action\.|prompt\.stale|game\.notYourTurn)/

class OnlineSession {
  phase: Phase = 'nickname'
  socketState: SocketState = 'idle'
  profile: PlayerProfile | null = null
  opponent: PlayerProfile | null = null
  turnTimeoutMs = 60_000

  search: { since: number } | null = null
  match: PendingMatch | null = null
  game: OnlineGame | null = null

  toasts: Toast[] = []
  /** error of the nickname form (i18n key) */
  signInError: string | null = null
  signingIn = false

  private token: string | null = null
  private socket: GameSocket | null = null
  private lastDeck: DeckDto | null = null
  /** serverTime - Date.now() */
  private clockOffset = 0

  constructor() {
    return reactive(this) as unknown as OnlineSession
  }

  // ------------------------------------------------------------------ session

  /** Re-uses the session of this browser tab (page reload, coming back from the menu) */
  resume() {
    if (this.socket) return
    const stored = readStored()
    if (!stored) {
      this.phase = 'nickname'
      return
    }
    this.token = stored.token
    this.profile = stored.profile
    this.connect()
  }

  async signIn(nickname: string, turnstileToken: string) {
    if (this.signingIn) return
    this.signingIn = true
    this.signInError = null
    try {
      const session = await api.createSession(nickname, turnstileToken)
      this.token = session.token
      this.profile = session.profile
      writeStored({ token: session.token, profile: session.profile })
      this.connect()
    } catch (e) {
      this.signInError = 'errors.' + (e instanceof ApiError ? e.code : 'server.error')
    } finally {
      this.signingIn = false
    }
  }

  /** Frees the nickname and returns to the nickname form */
  async signOut() {
    const token = this.token
    this.teardown()
    clearStored()
    this.token = null
    this.profile = null
    this.phase = 'nickname'
    if (token) await api.endSession(token).catch(() => {})
  }

  /** Leaving the online screen: the session stays valid for a while (reload / come back) */
  suspend() {
    this.teardown()
  }

  /** "Play here" after the session was opened in another tab */
  reclaim() {
    if (this.token) this.connect()
  }

  private connect() {
    this.socket?.disconnect()
    this.phase = 'connecting'
    this.socket = new GameSocket(this.token!, {
      message: (msg) => this.onMessage(msg),
      state: (state) => (this.socketState = state),
      fatal: (reason) => this.onFatal(reason),
    })
    this.socket.connect()
  }

  private teardown() {
    this.socket?.disconnect()
    this.socket = null
    this.disposeGame()
    this.search = null
    this.match = null
  }

  private onFatal(reason: FatalReason) {
    this.socket = null
    this.disposeGame()
    this.search = null
    this.match = null
    if (reason === 'session.replaced') {
      this.phase = 'replaced'
      return
    }
    // the session expired or the server was restarted: pick a nickname again
    clearStored()
    this.token = null
    this.profile = null
    this.phase = 'nickname'
    this.signInError = 'errors.' + reason
  }

  // ------------------------------------------------------------------ lobby

  findMatch(deck: DeckDto) {
    this.lastDeck = deck
    this.send({ type: 'findMatch', deck })
  }

  cancelSearch() {
    this.send({ type: 'cancelSearch' })
  }

  respond(accept: boolean) {
    const match = this.match
    if (!match || match.responded) return
    match.responded = true
    if (accept) match.youAccepted = true
    this.send({ type: 'respondMatch', matchId: match.id, accept })
  }

  /** End screen buttons */
  backToLobby(searchAgain: boolean) {
    this.disposeGame()
    this.phase = 'lobby'
    if (searchAgain && this.lastDeck) this.findMatch(this.lastDeck)
  }

  dismissToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id)
  }

  // ------------------------------------------------------------------ messages

  private send(msg: Parameters<GameSocket['send']>[0]) {
    const sent = this.socket?.send(msg) ?? false
    if (!sent) this.toast('errors.connection.lost', 'error')
    return sent
  }

  private onMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'welcome':
        this.profile = msg.profile
        this.turnTimeoutMs = msg.turnTimeoutMs
        this.clockOffset = msg.serverTime - Date.now()
        if (msg.status === 'IN_GAME') return // the game room re-sends gameStarted + state
        if (this.game && !this.game.view.over) {
          // the game ended while this tab was offline (forfeit after the grace period)
          this.disposeGame()
          this.toast('online.end.endedWhileAway', 'error')
        }
        if (!this.game) this.phase = 'lobby'
        this.search = null
        this.match = null
        return
      case 'error':
        if (this.game && RETRY_ERRORS.test(msg.code)) this.game.reopenTurn()
        this.toast('errors.' + msg.code, 'error')
        return
      case 'pong':
        return
      case 'searching':
        // server time -> local clock (elapsed time keeps counting on the client)
        this.search = { since: msg.sinceServerTime - this.clockOffset }
        return
      case 'searchCancelled':
        this.search = null
        return
      case 'matchFound':
        this.search = null
        this.match = {
          id: msg.matchId,
          opponent: msg.opponent,
          timeoutMs: msg.timeoutMs,
          endsAt: performance.now() + msg.timeoutMs,
          youAccepted: false,
          opponentAccepted: false,
          responded: false,
        }
        void AudioManager.playSFX('game_opening')
        return
      case 'matchUpdate':
        if (this.match?.id === msg.matchId) {
          this.match.youAccepted = msg.youAccepted
          this.match.opponentAccepted = msg.opponentAccepted
        }
        return
      case 'matchCancelled':
        if (this.match?.id === msg.matchId) this.match = null
        this.toast(cancelKey(msg.reason), msg.reason === 'declinedByYou' ? 'info' : 'error')
        if (!msg.searchingAgain) this.search = null
        return
      case 'gameStarted':
        this.match = null
        this.search = null
        this.profile = msg.self
        this.opponent = msg.opponent
        this.turnTimeoutMs = msg.turnTimeoutMs
        if (!this.game) {
          // the controller is plain JS (its view state is reactive on its own)
          this.game = markRaw(new OnlineGame(
            (m) => this.socket?.send(m) ?? false,
            () => [
              { label: 'online.end.searchAgain', run: () => this.backToLobby(true) },
              { label: 'online.end.lobby', run: () => this.backToLobby(false) },
            ],
          ))
          this.game.start()
        }
        this.phase = 'game'
        return
      default:
        this.game?.handle(msg)
    }
  }

  private disposeGame() {
    this.game?.dispose()
    this.game = null
    this.opponent = null
  }

  toast(key: string, kind: Toast['kind'] = 'info') {
    const id = ++toastSeq
    // the same message twice in a row (e.g. several invalid clicks) is shown once
    this.toasts = [...this.toasts.filter((t) => t.key !== key), { id, key, kind }].slice(-4)
    setTimeout(() => this.dismissToast(id), TOAST_MS)
  }
}

function cancelKey(reason: MatchCancelReason) {
  return 'online.match.cancelled.' + reason
}

function readStored(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    return typeof parsed?.token === 'string' && parsed.profile ? parsed : null
  } catch {
    return null
  }
}

function writeStored(session: StoredSession) {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(session))
  } catch {
    /* private mode: the session simply does not survive a reload */
  }
}

function clearStored() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export const online = new OnlineSession()
