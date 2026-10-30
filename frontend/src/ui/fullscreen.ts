// Full screen (hides the browser bars on phones) + landscape lock where the browser allows it (Android).
// iPhone Safari has no full screen API: there the app can be added to the home screen (manifest), or the
// board turns by itself in portrait (stage.ts).
import { reactive } from 'vue'

export const fullscreen = reactive({
  supported: typeof document !== 'undefined' && !!document.fullscreenEnabled,
  active: typeof document !== 'undefined' && !!document.fullscreenElement,
})

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => (fullscreen.active = !!document.fullscreenElement))
}

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> }

export async function toggleFullscreen() {
  if (!fullscreen.supported) return
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    // only allowed in full screen, and only on some devices: failing silently is fine
    await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape').catch(() => {})
  } catch {
    /* refused by the browser */
  }
}
