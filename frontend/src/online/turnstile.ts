interface Turnstile {
  render(element: HTMLElement, options: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}
declare global { interface Window { turnstile?: Turnstile } }

let pending: Promise<Turnstile> | undefined

/** One shared script load across retries and route changes. */
export function loadTurnstile(): Promise<Turnstile> {
  if (pending) return pending
  pending = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => {
      clearTimeout(timer)
      script.remove()
      pending = undefined
      reject(new Error('Turnstile unavailable'))
    }
    const timer = setTimeout(fail, 15000)
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onerror = fail
    script.onload = () => {
      if (!window.turnstile) return fail()
      clearTimeout(timer)
      resolve(window.turnstile)
    }
    document.head.appendChild(script)
  })
  return pending
}
