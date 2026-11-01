// REST part of the online mode: guest sessions. Everything else goes through the WebSocket.
import type { PlayerProfile } from './protocol'

export interface SessionResponse {
  token: string
  profile: PlayerProfile
  idleTtlSeconds: number
}

/** Error with a stable code from the server's ProblemDetail ({@code errors.<code>} in the translations) */
export class ApiError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'ApiError'
  }
}

/** same origin: the Vite dev server / nginx proxy /api and /ws to the backend */
const BASE = ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      signal: AbortSignal.timeout(10000),
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch {
    throw new ApiError('server.unreachable')
  }
  if (!response.ok) {
    let code = response.status === 429 ? 'rateLimited' : 'server.error'
    try {
      const problem = (await response.json()) as { code?: string }
      if (problem && typeof problem.code === 'string') code = problem.code
    } catch {
      /* not a problem+json body (proxy error page ...) */
    }
    throw new ApiError(code)
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
}

export const api = {
  challenge() {
    return request<{ siteKey: string }>('/api/v1/sessions/challenge')
  },

  createSession(nickname: string, turnstileToken: string) {
    return request<SessionResponse>('/api/v1/sessions', { method: 'POST', body: JSON.stringify({ nickname, turnstileToken }) })
  },

  availability(nickname: string) {
    return request<{ available: boolean; error: string | null }>(
      '/api/v1/sessions/availability?nickname=' + encodeURIComponent(nickname),
    )
  },

  endSession(token: string) {
    return request<void>('/api/v1/sessions/current', { method: 'DELETE', headers: { 'X-Session-Token': token } })
  },
}
