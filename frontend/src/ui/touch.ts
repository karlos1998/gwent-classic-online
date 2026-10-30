// Touch screens: there is no right mouse button, so holding a finger on a card does what the right click
// does (card details). A ring fills under the finger while holding, then a short vibration.
//
// The long press is turned into a synthetic `contextmenu` event on the element under the finger, so every
// existing right-click handler (board, hand, deck builder, inspector) works unchanged.
import { reactive } from 'vue'

const HOLD_MS = 420
const MOVE_TOLERANCE = 12
/** the ring only appears when the finger stays a moment (a plain tap shows nothing) */
const RING_DELAY = 110

export const touch = reactive({
  /** the main pointer is a finger (phone / tablet): hints and controls are shown for touch */
  coarse: false,
})

let installed = false
let timer = 0
let ringTimer = 0
let start: { x: number; y: number; target: EventTarget | null } | null = null
let ring: HTMLElement | null = null
/** time of the last touch: native context menus fired by the browser for a long press are ignored */
let lastTouch = 0
/** a long press fired: the click that the browser synthesises after the finger is lifted is swallowed */
let swallowClickUntil = 0

function showRing(x: number, y: number) {
  hideRing()
  ring = document.createElement('div')
  ring.className = 'touch-hold-ring'
  ring.style.left = x + 'px'
  ring.style.top = y + 'px'
  ring.style.setProperty('--hold', HOLD_MS - RING_DELAY + 'ms')
  ring.innerHTML = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/></svg>'
  document.body.appendChild(ring)
}

function hideRing(fired = false) {
  if (!ring) return
  const el = ring
  ring = null
  if (fired) {
    el.classList.add('done')
    setTimeout(() => el.remove(), 220)
  } else el.remove()
}

function cancel() {
  clearTimeout(timer)
  clearTimeout(ringTimer)
  start = null
  hideRing()
}

function fire() {
  if (!start) return
  const { x, y } = start
  const target = document.elementFromPoint(x, y) ?? (start.target as Element | null)
  start = null
  clearTimeout(ringTimer)
  hideRing(true)
  swallowClickUntil = Date.now() + 700
  try {
    navigator.vibrate?.(12)
  } catch {
    /* not allowed before a user gesture on some browsers */
  }
  target?.dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }),
  )
}

function onTouchStart(e: TouchEvent) {
  lastTouch = Date.now()
  touch.coarse = true
  if (e.touches.length !== 1) return cancel()
  const t = e.touches[0]
  const target = e.target as Element | null
  // text fields keep the native long press (select / paste)
  if (target?.closest?.('input, textarea, [contenteditable="true"]')) return cancel()
  cancel()
  start = { x: t.clientX, y: t.clientY, target: e.target }
  timer = window.setTimeout(fire, HOLD_MS)
  ringTimer = window.setTimeout(() => start && showRing(start.x, start.y), RING_DELAY)
}

function onTouchMove(e: TouchEvent) {
  if (!start) return
  const t = e.touches[0]
  if (!t || Math.hypot(t.clientX - start.x, t.clientY - start.y) > MOVE_TOLERANCE) cancel()
}

function onTouchEnd(e: TouchEvent) {
  lastTouch = Date.now()
  if (start) cancel()
  // the long press already acted: no click / selection on lifting the finger
  else if (Date.now() < swallowClickUntil && e.cancelable) e.preventDefault()
}

function onClick(e: MouseEvent) {
  if (Date.now() < swallowClickUntil) {
    swallowClickUntil = 0
    e.preventDefault()
    e.stopImmediatePropagation()
  }
}

function onNativeContextMenu(e: MouseEvent) {
  // Android fires its own context menu for a long press: ours (synthetic, isTrusted = false) replaces it
  if (e.isTrusted && Date.now() - lastTouch < 1500) {
    const target = e.target as Element | null
    if (target?.closest?.('input, textarea, [contenteditable="true"]')) return
    e.preventDefault()
    e.stopImmediatePropagation()
  }
}

export function installTouch() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const coarse = window.matchMedia?.('(pointer: coarse)')
  touch.coarse = !!coarse?.matches
  coarse?.addEventListener?.('change', (e) => (touch.coarse = e.matches))
  document.documentElement.classList.toggle('touch', touch.coarse)

  const opts = { capture: true, passive: true }
  window.addEventListener('touchstart', onTouchStart, opts)
  window.addEventListener('touchmove', onTouchMove, opts)
  window.addEventListener('touchend', onTouchEnd, { capture: true, passive: false })
  window.addEventListener('touchcancel', cancel, opts)
  window.addEventListener('scroll', cancel, opts)
  window.addEventListener('click', onClick, true)
  window.addEventListener('contextmenu', onNativeContextMenu, true)
}

/**
 * Horizontal swipe on an element (carousel): calls back with -1 (to the left) or 1 (to the right).
 * Works in the element's own frame, so it also works on the rotated board (see stage.ts).
 */
export function onSwipe(el: HTMLElement, toLocal: (x: number, y: number) => { x: number; y: number }, cb: (dir: -1 | 1) => void) {
  let from: { x: number; y: number; t: number } | null = null
  const down = (e: TouchEvent) => {
    if (e.touches.length !== 1) return (from = null)
    const p = toLocal(e.touches[0].clientX, e.touches[0].clientY)
    from = { ...p, t: Date.now() }
  }
  const up = (e: TouchEvent) => {
    const t = e.changedTouches[0]
    if (!from || !t) return
    const p = toLocal(t.clientX, t.clientY)
    const dx = p.x - from.x
    const dy = p.y - from.y
    const fast = Date.now() - from.t < 600
    from = null
    if (fast && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swallowClickUntil = Date.now() + 400
      cb(dx < 0 ? 1 : -1)
    }
  }
  el.addEventListener('touchstart', down, { passive: true })
  el.addEventListener('touchend', up, { passive: true })
  return () => {
    el.removeEventListener('touchstart', down)
    el.removeEventListener('touchend', up)
  }
}
