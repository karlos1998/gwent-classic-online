// Right-click card inspection (as in The Witcher 3: right mouse button shows a big card with its description)
import { reactive } from 'vue'
import { Card, card_dict } from '@/engine'
import type { CarouselItem } from './store'
import { AudioManager } from './audio'

export const inspector = reactive({ card: null as CarouselItem | null })

export function inspectCard(card: CarouselItem | null | undefined) {
  if (!card) return
  inspector.card = card
  AudioManager.playSFX('open')
}

/** Card from the card list (deck builder): index into card_dict */
export function inspectCardIndex(index: number) {
  const data = card_dict[index]
  if (data) inspectCard(new Card(data, null))
}

export function closeInspector() {
  inspector.card = null
}
