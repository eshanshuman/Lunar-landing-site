import type { SiteData } from '../types'
import { sunVisible } from './visibility'

export interface DarkRun {
  /** Length of the longest stretch with the Sun behind the terrain, in steps (hours). */
  hours: number
  /** Index of its first step, or null when the Sun never sets. */
  start: number | null
  /** The stretch runs into the end of the window or the data, so the real night may be longer. */
  open: boolean
}

/** Longest run of Sun-blocked steps in [start, start + length), clipped to the data. */
export function longestDark(d: SiteData, start: number, length: number): DarkRun {
  const end = Math.min(start + length, d.sun.el.length)
  let best: DarkRun = { hours: 0, start: null, open: false }
  let runStart = -1
  for (let i = start; i <= end; i++) {
    const dark = i < end && !sunVisible(d, i)
    if (dark && runStart < 0) runStart = i
    if (!dark && runStart >= 0) {
      const len = i - runStart
      if (len > best.hours) best = { hours: len, start: runStart, open: i === end }
      runStart = -1
    }
  }
  return best
}

/**
 * Share of the sky dome above the local horizontal that the terrain hides.
 * Each azimuth sample contributes the solid-angle fraction between 0° and the skyline,
 * sin(h) for h > 0; skyline below the horizontal hides nothing. Pure geometry.
 */
export function skyBlockedFraction(horizon: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < horizon.length; i++) s += Math.sin((Math.max(0, horizon[i]) * Math.PI) / 180)
  return horizon.length ? s / horizon.length : 0
}

/** Battery energy needed to ride out `hours` of darkness at a constant draw of `watts`. */
export const batteryWh = (watts: number, hours: number) => watts * hours
