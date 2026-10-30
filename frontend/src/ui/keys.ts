// Keyboard controls of the board, as in The Witcher 3 Gwent:
//   hold Space  - pass the round (with a progress indicator on the Pass button)
//   Esc         - close the selected card / dialogs, otherwise ask to leave the game
// Carousels (redraw, choices) handle their own keys in CarouselView.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ui } from './store'

const HOLD_TO_PASS_MS = 800

const typing = (e: KeyboardEvent) => !!(e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]')

export function useBoardKeys(onExit: () => void) {
  /** 0..1 progress of the held Space key */
  const hold = ref(0)
  let started = 0
  let frame = 0

  const canPass = () =>
    !ui.passNoclick && !ui.mainNoclick && !ui.carouselCurr && !ui.popupState.visible && ui.endScreen.hidden && !ui.customizationVisible

  const stopHold = () => {
    cancelAnimationFrame(frame)
    frame = 0
    started = 0
    hold.value = 0
  }

  const tick = () => {
    if (!canPass()) return stopHold()
    hold.value = Math.min(1, (performance.now() - started) / HOLD_TO_PASS_MS)
    if (hold.value >= 1) {
      stopHold()
      ui.passRound()
      return
    }
    frame = requestAnimationFrame(tick)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.code === 'Space') {
      if (ui.customizationVisible) return
      e.preventDefault() // no page scrolling / button activation
      if (!e.repeat && !started && canPass()) {
        started = performance.now()
        frame = requestAnimationFrame(tick)
      }
      return
    }
    if (e.key !== 'Escape') return
    if (ui.popupState.visible) {
      // "Resume" on the leave-game question; other questions need an explicit answer
      if (ui.popupState.yesName === 'popup.resume') ui.popupSelect(true)
      return
    }
    if (ui.carouselCurr) return // handled by CarouselView
    if (ui.previewCard && ui.clickBackgroundActive) {
      ui.cancel()
      return
    }
    if (!ui.customizationVisible && ui.endScreen.hidden) onExit()
  }

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') stopHold()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', stopHold)
  })
  onBeforeUnmount(() => {
    stopHold()
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', stopHold)
  })
  return { hold }
}
