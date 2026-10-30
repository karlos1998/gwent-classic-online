// The board is designed for 16:9 in vw units (like the original). On windows that are wider than 16:9
// it would be taller than the screen and scroll, so the whole stage is scaled down with CSS zoom.
import { reactive } from 'vue'

export const STAGE_RATIO = 1080 / 1920

export const stage = reactive({ zoom: 1 })

function update() {
  if (typeof window === 'undefined') return
  const height = window.innerWidth * STAGE_RATIO
  stage.zoom = Math.min(1, window.innerHeight / height)
}

if (typeof window !== 'undefined') {
  update()
  window.addEventListener('resize', update)
}

/** current zoom of the stage (1 = no scaling) */
export const stageZoom = () => stage.zoom
