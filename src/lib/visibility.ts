/**
 * Line-of-sight maths shared by every panel: skyline interpolation, per-window stats and
 * countdowns to the next rise/set. Pure functions over the PLAN.md §6 site schema.
 *
 * "Visible" is purely geometric: the body's centre is above the terrain skyline at its azimuth.
 * No atmosphere, so there is no refraction term.
 */
import type { SiteData, Track } from '../types'

export type Body = 'sun' | 'earth'

/** Skyline height (deg) at any azimuth, linearly interpolated and wrapping at 360°. */
export function horizonAt(horizon: ArrayLike<number>, az: number): number {
  const n = horizon.length
  const x = ((((az % 360) + 360) % 360) / 360) * n
  const a = Math.floor(x) % n
  const f = x - Math.floor(x)
  return horizon[a] * (1 - f) + horizon[(a + 1) % n] * f
}

export const isVisible = (d: SiteData, which: Body, i: number) => {
  if (d.vis) return ((d.vis[which][i >> 3] >> (i & 7)) & 1) === 1
  const tr: Track = d[which]
  return tr.el[i] > horizonAt(d.horizon_deg, tr.az[i])
}
export const sunVisible = (d: SiteData, i: number) => isVisible(d, 'sun', i)
export const earthVisible = (d: SiteData, i: number) => isVisible(d, 'earth', i)

export interface WindowStats {
  /** Steps in the window (hours when step_h is 1). */
  n: number
  sun: number
  earth: number
  sunF: number
  earthF: number
  /** Longest run with the Sun blocked. */
  maxDark: number
  /** Longest run with Earth blocked. */
  maxGap: number
  /** Steps from landing to the first step without Sun; null if the Sun never sets in the window. */
  firstSet: number | null
}

/** Stats over [start, start + length), clipped to the data that exists. */
export function windowStats(d: SiteData, start: number, length: number): WindowStats {
  const end = Math.min(start + length, d.sun.el.length)
  let sun = 0, earth = 0, dark = 0, maxDark = 0, gap = 0, maxGap = 0
  let firstSet: number | null = null
  for (let i = start; i < end; i++) {
    if (sunVisible(d, i)) {
      sun++
      dark = 0
    } else {
      dark++
      if (dark > maxDark) maxDark = dark
      if (firstSet === null) firstSet = i - start
    }
    if (earthVisible(d, i)) {
      earth++
      gap = 0
    } else {
      gap++
      if (gap > maxGap) maxGap = gap
    }
  }
  const n = Math.max(0, end - start)
  return { n, sun, earth, sunF: n ? sun / n : 0, earthF: n ? earth / n : 0, maxDark, maxGap, firstSet }
}

export const OK_FRACTION = 0.75

/** Slip-grid colour: 2 = sunlight and Earth contact both ≥ 75%, 1 = one of them, 0 = neither. */
export function status(st: WindowStats): 0 | 1 | 2 {
  return ((st.sunF >= OK_FRACTION ? 1 : 0) + (st.earthF >= OK_FRACTION ? 1 : 0)) as 0 | 1 | 2
}

export interface Flip {
  /** Is the body visible at step i? */
  now: boolean
  /** Steps until that changes; null if it does not change within the data. */
  h: number | null
}

/** Countdown to the next set (if visible now) or rise (if blocked now). */
export function nextFlip(d: SiteData, i: number, which: Body): Flip {
  const now = isVisible(d, which, i)
  const len = d[which].el.length
  for (let k = i + 1; k < len; k++) if (isVisible(d, which, k) !== now) return { now, h: k - i }
  return { now, h: null }
}
