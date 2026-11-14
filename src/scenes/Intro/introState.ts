/** Remembers that the intro has been watched. Storage can be missing or blocked; the app must still work. */
const KEY = 'lunar-navigator:intro-seen'

export function introSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function markIntroSeen(): void {
  try {
    window.localStorage.setItem(KEY, '1')
  } catch {
    /* storage unavailable: the intro simply plays again next visit */
  }
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/** Total running time, seconds (PLAN.md §3: at most 12 s). */
export const INTRO_SECONDS = 12
/** When the site pins and the interface come in. */
export const REVEAL_AT = 8.6

/** Lower-third captions and the second each one starts at. */
export const CAPTIONS: [number, string][] = [
  [0.3, 'Every Moon mission starts with a date.'],
  [2.4, 'But launch dates slip.'],
  [5.2, 'At the South Pole, the Sun barely clears the horizon.'],
  [8.4, 'Pick a site. Pick a date. See what you get.'],
]
export const captionAt = (t: number) => {
  let text = ''
  for (const [at, c] of CAPTIONS) if (t >= at) text = c
  return t >= INTRO_SECONDS - 0.9 ? '' : text
}
