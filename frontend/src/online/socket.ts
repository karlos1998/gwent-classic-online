// WebSocket transport: authentication, keep-alive and automatic reconnection.
import { CloseCode, type ClientMessage, type ServerMessage } from './protocol'

export type SocketState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

/** Reasons that end the connection for good (no reconnect) */
export type FatalReason = 'session.replaced' | 'auth.invalid' | 'auth.timeout'

export interface SocketHandlers {
  message(msg: ServerMessage): void
  state(state: SocketState): void
  fatal(reason: FatalReason): void
}

const PING_INTERVAL_MS = 25_000
const MAX_BACKOFF_MS = 10_000

function socketUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws`
}

export class GameSocket {
  private ws: WebSocket | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private attempts = 0
  private stopped = true
  private state: SocketState = 'idle'

  constructor(
    private readonly token: string,
    private readonly handlers: SocketHandlers,
  ) {}

  connect() {
    this.stopped = false
    this.open()
  }

  /** Closes the connection and stops reconnecting */
  disconnect() {
    this.stopped = true
    this.clearTimers()
    const ws = this.ws
    this.ws = null
    if (ws && ws.readyState <= WebSocket.OPEN) ws.close(1000)
    this.setState('closed')
  }

  send(message: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    this.ws.send(JSON.stringify(message))
    return true
  }

  get isOpen() {
    return this.state === 'open'
  }

  private open() {
    this.setState(this.attempts === 0 ? 'connecting' : 'reconnecting')
    const ws = new WebSocket(socketUrl())
    this.ws = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: this.token } satisfies ClientMessage))
      this.pingTimer = setInterval(() => this.send({ type: 'ping' }), PING_INTERVAL_MS)
    }

    ws.onmessage = (event) => {
      let msg: ServerMessage
      try {
        msg = JSON.parse(String(event.data)) as ServerMessage
      } catch {
        return
      }
      if (msg.type === 'welcome') {
        this.attempts = 0
        this.setState('open')
      }
      this.handlers.message(msg)
    }

    ws.onclose = (event) => {
      if (this.ws !== ws) return // replaced by a newer socket
      this.ws = null
      this.clearTimers()
      if (this.stopped) return
      const fatal = fatalReason(event.code)
      if (fatal) {
        this.stopped = true
        this.setState('closed')
        this.handlers.fatal(fatal)
        return
      }
      this.scheduleReconnect(event.code === CloseCode.RATE_LIMITED ? 5_000 : 0)
    }
  }

  private scheduleReconnect(minDelay: number) {
    this.attempts++
    this.setState('reconnecting')
    const delay = Math.max(minDelay, Math.min(MAX_BACKOFF_MS, 500 * 2 ** (this.attempts - 1)))
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (!this.stopped) this.open()
    }, delay)
  }

  private clearTimers() {
    if (this.pingTimer) clearInterval(this.pingTimer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.pingTimer = this.retryTimer = null
  }

  private setState(state: SocketState) {
    if (this.state === state) return
    this.state = state
    this.handlers.state(state)
  }
}

function fatalReason(code: number): FatalReason | null {
  switch (code) {
    case CloseCode.REPLACED:
      return 'session.replaced'
    case CloseCode.AUTH_FAILED:
      return 'auth.invalid'
    case CloseCode.AUTH_TIMEOUT:
      return 'auth.timeout'
    default:
      return null
  }
}
