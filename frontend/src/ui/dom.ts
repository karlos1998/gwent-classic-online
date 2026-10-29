// Registry of rendered elements, needed to measure positions for card flight animations
// (the original moved the very same DOM node; in Vue we measure and animate a "ghost").
import type { ComponentPublicInstance } from 'vue'

const cards = new Map<number, HTMLElement>()
const containers = new Map<string, HTMLElement>()

type RefArg = Element | ComponentPublicInstance | null

export function registerCard(uid: number) {
  return (el: RefArg) => {
    if (el instanceof HTMLElement) cards.set(uid, el)
    else if (cards.get(uid) && !cards.get(uid)!.isConnected) cards.delete(uid)
  }
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
