// Helpers ported from the original common.js / gwent.js

/** Thrown into stale coroutines after the game was reset (e.g. player quit mid-turn). */
export class GameAborted extends Error {
  constructor() {
    super('Game aborted')
    this.name = 'GameAborted'
  }
}

/** Incremented on every Game.reset(); sleeps started in an older epoch reject with GameAborted. */
export const runtime = { epoch: 0 }

export function removeFrom<T>(arr: T[], elem: T) {
  const index = arr.indexOf(elem)
  if (index !== -1) arr.splice(index, 1)
}

export function isEmpty(obj: object | null | undefined): boolean {
  if (!obj) return true
  for (const property in obj) {
    if (Object.hasOwn(obj, property)) return false
  }
  return true
}

/** returns val or the min/max it is closest to. Flips inverted min/max values. */
export function clamp(min: number, max: number, val: number): number {
  if (min > max) return clamp(max, min, val)
  return Math.min(max, Math.max(min, val))
}

export function lerp(a: number, b: number, t: number) {
  return (1 - t) * a + t * b
}

export function inverseLerp(a: number, b: number, t: number) {
  return (t - a) / (b - a)
}

export function map(a: number, b: number, y: number, z: number, t: number) {
  return lerp(y, z, inverseLerp(a, b, t))
}

export function isNumber(n: unknown): n is number {
  return typeof n === 'number' && isFinite(n)
}

export function isString(s: unknown): s is string {
  return typeof s === 'string' || s instanceof String
}

/** Interprets passed string as an integer. Empty strings return 0 (same quirk as original). */
export function toInteger(str: string | number | null | undefined): number {
  if (str === '' || str === null || str === undefined) return 0
  return Number.parseInt(String(str))
}

/** Returns a random integer in the range [0,n) */
export function randomInt(n: number) {
  return Math.floor(Math.random() * n)
}

/** Pauses execution until the passed number of milliseconds has expired */
export function sleep(ms: number): Promise<void> {
  const epoch = runtime.epoch
  return new Promise((resolve, reject) =>
    setTimeout(() => (runtime.epoch === epoch ? resolve() : reject(new GameAborted())), ms),
  )
}

/** Suspends execution until the predicate condition is met, checking every ms milliseconds */
export function sleepUntil(predicate: () => boolean, ms?: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer)
        resolve()
      }
    }, ms)
  })
}

export const DUR_FADE_STEP = 10

/** Something that can be faded: mirrors an element's inline opacity + "hide" class. */
export interface Fadeable {
  opacity: number | null
  hidden: boolean
}

export function fadeIn(target: Fadeable, duration: number) {
  return fade(true, target, duration)
}

export function fadeOut(target: Fadeable, duration: number) {
  return fade(false, target, duration)
}

/** Fades over a duration (same stepping as original, incl. integer start-opacity quirk) */
export function fade(fadeIn: boolean, target: Fadeable, dur: number): Promise<void> {
  if (!target) return Promise.resolve()
  return new Promise((res) => {
    const startingOpacity = toInteger(target.opacity === null ? '' : target.opacity)
    const endOpacity = fadeIn ? 1 : 0
    const startTime = Date.now()
    const endTime = startTime + dur
    if (fadeIn) target.hidden = false
    const timer = setInterval(() => {
      const currTime = Date.now()
      const op = clamp(startingOpacity, endOpacity, map(startTime, endTime, startingOpacity, endOpacity, currTime))
      target.opacity = op
      if (op === endOpacity) {
        clearInterval(timer)
        if (!fadeIn) target.hidden = true
        res()
      }
    }, DUR_FADE_STEP)
  })
}
