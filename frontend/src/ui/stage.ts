// The board is designed for 16:9 in vw units (like the original). On windows that are wider than 16:9
// it would be taller than the screen and scroll, so the whole stage is scaled down with CSS zoom.
//
// Phones held upright: the board is a landscape game, so on board screens the whole app is turned by 90°
// (html.gwent-rotated). Turning the phone then shows it upright - also with the rotation lock on. With the
// rotation lock off the browser itself switches to landscape and the app is drawn normally again.
import { reactive } from 'vue'

export const STAGE_RATIO = 1080 / 1920

export const stage = reactive({
  zoom: 1,
  /** the app is drawn turned by 90° (portrait phone on a board screen) */
  rotated: false,
  /** a board screen (GameStage) is shown */
  board: false,
})

const coarse = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches

function update() {
  if (typeof window === 'undefined') return
  const w = window.innerWidth
  const h = window.innerHeight
  const rotated = stage.board && coarse() && h > w
  stage.rotated = rotated
  const root = document.documentElement
  root.classList.toggle('gwent-rotated', rotated)
  root.style.setProperty('--vp-w', w + 'px')
  root.style.setProperty('--vp-h', h + 'px')
  // size of the screen as the player sees it
  const viewW = rotated ? h : w
  const viewH = rotated ? w : h
  // 1% of the screen as seen by the player: overlays that must stay readable on phones are sized with it
  root.style.setProperty('--lw', viewW / 100 + 'px')
  root.style.setProperty('--lh', viewH / 100 + 'px')
  // vw is the real viewport width (the short side when turned): overlays outside the stage zoom by this
  root.style.setProperty('--rot-z', String(viewW / w))
  // the stage is 100vw wide (vw = real viewport width) and 16:9
  const zoom = Math.min(viewW / w, viewH / (w * STAGE_RATIO))
  stage.zoom = rotated ? zoom : Math.min(1, zoom)
}

if (typeof window !== 'undefined') {
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', () => setTimeout(update, 50))
  window.visualViewport?.addEventListener('resize', update)
}

export function setBoardScreen(on: boolean) {
  stage.board = on
  update()
}

/** current zoom of the stage (1 = no scaling) */
export const stageZoom = () => stage.zoom

/** screen point -> point in the app's own (possibly rotated) frame */
export function toLocalPoint(x: number, y: number) {
  return stage.rotated ? { x: y, y: window.innerWidth - x } : { x, y }
}

/** screen rect (getBoundingClientRect) -> rect in the app's own frame */
export function toLocalRect(r: DOMRect | { left: number; top: number; width: number; height: number }) {
  if (!stage.rotated) return { left: r.left, top: r.top, width: r.width, height: r.height }
  return { left: r.top, top: window.innerWidth - (r.left + r.width), width: r.height, height: r.width }
}

/** parent for floating elements (flight ghosts) that must be turned together with the app */
export const overlayRoot = () => document.getElementById('app') ?? document.body
