// Registry of rendered elements, needed to measure positions for card flight animations
// (the original moved the very same DOM node; in Vue we measure and animate a "ghost").
import type { ComponentPublicInstance } from 'vue'

const cards = new Map<number, HTMLElement>()
/** card objects of the rendered elements (right-click inspection works even on noclick elements) */
const cardObjects = new Map<number, unknown>()
const containers = new Map<string, HTMLElement>()

type RefArg = Element | ComponentPublicInstance | null

export function registerCard(uid: number, card?: unknown) {
  return (el: RefArg) => {
    if (el instanceof HTMLElement) {
      cards.set(uid, el)
      if (card) cardObjects.set(uid, card)
    } else if (cards.get(uid) && !cards.get(uid)!.isConnected) {
      cards.delete(uid)
      cardObjects.delete(uid)
    }
  }
}

/**
 * The topmost rendered card under a screen point. Uses geometry instead of event targets because the
 * board disables pointer events (class noclick) while it is not the player's turn.
 */
export function cardAtPoint<T>(x: number, y: number): T | undefined {
  let best: { el: HTMLElement; uid: number } | undefined
  for (const [uid, el] of cards) {
    if (!el.isConnected || !cardObjects.has(uid)) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || x < r.left || x > r.right || y < r.top || y > r.bottom) continue
    if (getComputedStyle(el).visibility === 'hidden') continue
    // overlapping cards (hand, piles): the later element in the document is drawn on top
    if (!best || best.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = { el, uid }
  }
  return best ? (cardObjects.get(best.uid) as T) : undefined
}

export function registerContainer(key: string) {
  return (el: RefArg) => {
    if (el instanceof HTMLElement) containers.set(key, el)
  }
}

export function cardElement(uid: number): HTMLElement | undefined {
  const el = cards.get(uid)
  return el && el.isConnected ? el : undefined
}

export function containerElement(key: string): HTMLElement | undefined {
  const el = containers.get(key)
  return el && el.isConnected ? el : undefined
}
