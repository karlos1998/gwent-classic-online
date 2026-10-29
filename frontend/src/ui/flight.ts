// Card flight animation - port of the original translateTo()/translate().
// The original physically moved card.elem with a CSS transform and re-parented it afterwards.
// With Vue the element is re-rendered by the destination container, so we fly a "ghost" copy
// using the same geometry formula, hide the real card meanwhile and drop the ghost once the
// engine has moved the card (next tick).
import { h, render } from 'vue'
import { ctx, Deck, HandAI, Row, sleep, type Card, type CardContainer } from '@/engine'
import { cardElement, containerElement } from './dom'
import CardView from './components/CardView.vue'

interface Box {
  left: number
  top: number
  width: number
  height: number
}

const vw = () => window.innerWidth / 100
const cardW = () => 4.45 * vw()
const cardH = () => 6.35 * vw()

function box(el: Element): Box {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

// Returns the source container's element to transition from
function getSourceElem(source: CardContainer): HTMLElement | undefined {
  const el = containerElement(source.key)
  if (source instanceof Deck && el) {
    const backs = el.querySelectorAll<HTMLElement>('.deck-card')
    return backs.length ? backs[backs.length - 1] : el
  }
  return el
}

// Returns the destination container's element to transition to
function getDestinationElem(card: Card, dest: CardContainer): HTMLElement | undefined {
  if (dest instanceof HandAI) return containerElement(dest.key)
  if (card.isSpecial() && dest instanceof Row) return containerElement(dest.key + '-special')
  if (dest instanceof Row || dest === ctx.me?.hand || dest === ctx.weather) {
    if (dest.cards.length === 0) return containerElement(dest.key)
    const index = dest.getSortedIndex(card)
    const dcard = dest.cards[index === dest.cards.length ? index - 1 : index]
    return cardElement(dcard.uid) ?? containerElement(dest.key)
  }
  return containerElement(dest.key)
}

export async function translateTo(card: Card, container_source: CardContainer | null | undefined, container_dest: CardContainer) {
  if (!container_dest || !container_source) return
  if (container_dest === ctx.op.hand && container_source === ctx.op.deck) return

  const elem = cardElement(card.uid)
  const sourceEl = getSourceElem(container_source)
  const destEl = getDestinationElem(card, container_dest)
  if (!destEl || (!elem && !sourceEl)) {
    await sleep(499)
    return
  }

  // Where does the card start? (original: if not in the document it was appended to the source element)
  let start: Box
  const inDocument = elem && elem.getBoundingClientRect().width !== 0
  if (inDocument) start = box(elem!)
  else {
    const s = box(sourceEl!)
    if (container_source instanceof Deck || container_source instanceof HandAI) {
      start = { left: s.left, top: s.top, width: cardW(), height: cardH() }
    } else {
      // appended as last flex child: approximate with the right end of the rendered cards
      const last = container_source.cards.length
        ? cardElement(container_source.cards[container_source.cards.length - 1].uid)
        : undefined
      const l = last ? box(last) : null
      start = l
        ? { left: l.left + l.width, top: l.top, width: cardW(), height: cardH() }
        : { left: s.left + s.width / 2 - cardW() / 2, top: s.top + s.height - cardH(), width: cardW(), height: cardH() }
    }
  }

  // The original formula was `dest.center - elem.width` and relied on the moving element's own flex slot
  // collapsing (margin-right = -width) which shifts it by +width/2 (AI cards got an explicit +width/2).
  // Net visual effect: the card lands centred on the destination. Our ghost is position:fixed, so we
  // compute that centred landing directly and keep the original neighbour / hand adjustments.
  const dest = box(destEl)
  let x = dest.left - start.left + dest.width / 2 - start.width / 2
  let y = dest.top - start.top + dest.height / 2 - start.height / 2
  if (container_dest instanceof Row && container_dest.cards.length !== 0 && !card.isSpecial()) {
    x += container_dest.getSortedIndex(card) === container_dest.cards.length ? start.width / 2 : -start.width / 2
  }
  if (container_source instanceof Row && container_dest === ctx.me.hand) y *= 7 / 8

  // Build the ghost
  const host = document.createElement('div')
  host.className = 'card-flight'
  Object.assign(host.style, {
    position: 'fixed',
    left: start.left + 'px',
    top: start.top + 'px',
    width: start.width + 'px',
    height: start.height + 'px',
    zIndex: '2',
    pointerEvents: 'none',
    transition: 'transform 0.5s',
    transform: 'translate(0px, 0px)',
  } as CSSStyleDeclaration)
  document.body.appendChild(host)
  render(h(CardView, { card, ghost: true }), host)

  card.flying++
  // start the transition on the next frame
  host.getBoundingClientRect()
  requestAnimationFrame(() => (host.style.transform = `translate(${x}px, ${y}px)`))

  try {
    await sleep(499)
  } finally {
    // The caller moves the card right after we resolve; drop the ghost after Vue re-rendered.
    setTimeout(() => {
      card.flying = Math.max(0, card.flying - 1)
      render(null, host)
      host.remove()
    }, 0)
  }
}
