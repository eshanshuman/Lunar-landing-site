import { describe, expect, it } from 'vitest'
import type { SiteData } from '../types'
import { sampleDataset } from '../data/sample'
import { earthVisible, horizonAt, nextFlip, status, sunVisible, windowStats } from './visibility'

/** Site with a flat skyline at `horizon` degrees and hand-written Sun / Earth elevations. */
function site(sunEl: number[], earthEl: number[] = sunEl.map(() => 5), horizon: number[] = [0, 0, 0, 0]): SiteData {
  const az = sunEl.map(() => 10)
  return {
    id: 't',
    start_utc: '2028-01-01T00:00:00Z',
    step_h: 1,
    horizon_deg: horizon,
    sun: { az, el: sunEl },
    earth: { az, el: earthEl },
    meta: { dem: 'test', observer_height_m: 2, ephemeris: 'test' },
  }
}

describe('horizonAt', () => {
  const h = [0, 2, 4, 2] // samples at 0°, 90°, 180°, 270°
  it('returns the sample at its own azimuth', () => {
    expect(horizonAt(h, 0)).toBe(0)
    expect(horizonAt(h, 90)).toBe(2)
    expect(horizonAt(h, 180)).toBe(4)
  })
  it('interpolates linearly between samples', () => {
    expect(horizonAt(h, 45)).toBeCloseTo(1)
    expect(horizonAt(h, 135)).toBeCloseTo(3)
    expect(horizonAt(h, 99)).toBeCloseTo(2.2)
  })
  it('wraps across north', () => {
    expect(horizonAt(h, 315)).toBeCloseTo(1) // between 270° (2) and 0° (0)
    expect(horizonAt(h, 360)).toBe(0)
    expect(horizonAt(h, -90)).toBe(2)
    expect(horizonAt(h, 450)).toBe(2)
  })
  it('handles the 720-value schema resolution (0.5° steps)', () => {
    const h720 = Array.from({ length: 720 }, (_, i) => i)
    expect(horizonAt(h720, 10)).toBeCloseTo(20)
    expect(horizonAt(h720, 10.25)).toBeCloseTo(20.5)
    expect(horizonAt(h720, 359.75)).toBeCloseTo(719 / 2) // halfway back to sample 0
  })
})

describe('visibility', () => {
  it('needs the body strictly above the skyline at its azimuth', () => {
    const d = site([1, 0, -1], [3, 2.5, 1], [2, 2, 2, 2])
    expect([0, 1, 2].map((i) => sunVisible(d, i))).toEqual([false, false, false])
    expect([0, 1, 2].map((i) => earthVisible(d, i))).toEqual([true, true, false])
  })
  it('uses the skyline in the direction of the body', () => {
    const d = site([1, 1], [5, 5], [0, 3, 0, 0])
    ;(d.sun.az as number[])[1] = 90 // second hour: Sun behind the 3° ridge to the east
    expect(sunVisible(d, 0)).toBe(true)
    expect(sunVisible(d, 1)).toBe(false)
  })
})

describe('windowStats', () => {
  //            hour: 0  1  2   3   4   5  6   7  8  9
  const sun = [1, 1, -1, -1, -1, 1, 1, -1, 1, 1]
  const earth = [1, -1, -1, 1, 1, 1, 1, 1, 1, -1]
  const d = site(sun, earth)

  it('counts visible hours and fractions', () => {
    const st = windowStats(d, 0, 10)
    expect(st).toMatchObject({ n: 10, sun: 6, earth: 7, sunF: 0.6, earthF: 0.7 })
  })
  it('finds the longest dark stretch and the longest Earth gap', () => {
    const st = windowStats(d, 0, 10)
    expect(st.maxDark).toBe(3)
    expect(st.maxGap).toBe(2)
  })
  it('reports the first sunset relative to the window start', () => {
    expect(windowStats(d, 0, 10).firstSet).toBe(2)
    expect(windowStats(d, 5, 5).firstSet).toBe(2)
    expect(windowStats(d, 2, 3).firstSet).toBe(0) // lands in the dark
    expect(windowStats(d, 0, 2).firstSet).toBeNull() // Sun never sets
  })
  it('only looks inside the window', () => {
    const st = windowStats(d, 5, 2)
    expect(st).toMatchObject({ n: 2, sun: 2, earth: 2, maxDark: 0, maxGap: 0 })
  })
  it('clips a window that runs past the end of the data', () => {
    const st = windowStats(d, 8, 10)
    expect(st).toMatchObject({ n: 2, sun: 2, earth: 1 })
  })
})

describe('status', () => {
  const st = (sunF: number, earthF: number) => ({ ...windowStats(site([1]), 0, 1), sunF, earthF })
  it('is 2 when sunlight and Earth contact are both at least 75%', () => {
    expect(status(st(0.75, 0.75))).toBe(2)
    expect(status(st(1, 0.9))).toBe(2)
  })
  it('is 1 when only one of them is', () => {
    expect(status(st(0.74, 0.9))).toBe(1)
    expect(status(st(0.9, 0.1))).toBe(1)
  })
  it('is 0 when neither is', () => {
    expect(status(st(0.7, 0.7))).toBe(0)
  })
})

describe('nextFlip', () => {
  const d = site([1, 1, -1, -1, -1, 1, 1, -1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  it('counts hours to sunset while the Sun is up', () => {
    expect(nextFlip(d, 0, 'sun')).toEqual({ now: true, h: 2 })
    expect(nextFlip(d, 1, 'sun')).toEqual({ now: true, h: 1 })
  })
  it('counts hours to sunrise while the Sun is blocked', () => {
    expect(nextFlip(d, 2, 'sun')).toEqual({ now: false, h: 3 })
    expect(nextFlip(d, 7, 'sun')).toEqual({ now: false, h: 1 })
  })
  it('returns null when nothing changes before the data ends', () => {
    expect(nextFlip(d, 8, 'sun')).toEqual({ now: true, h: null })
    expect(nextFlip(d, 0, 'earth')).toEqual({ now: true, h: null })
  })
})

describe('sample dataset', () => {
  it('matches the PLAN.md §6 site schema', () => {
    const hours = (sampleDataset.days + Math.max(...sampleDataset.missionLengths)) * 24
    for (const s of sampleDataset.sites) {
      const d = sampleDataset.bySite[s.id]
      expect(d.id).toBe(s.id)
      expect(d.step_h).toBe(1)
      expect(d.horizon_deg.length).toBe(720)
      for (const tr of [d.sun, d.earth]) {
        expect(tr.az.length).toBe(hours)
        expect(tr.el.length).toBe(hours)
        expect(Array.from(tr.az).every((a) => a >= 0 && a < 360)).toBe(true)
      }
    }
  })
  it('is deterministic', async () => {
    const { buildSampleSite } = await import('../data/sample')
    const a = buildSampleSite(sampleDataset.sites[0])
    expect(Array.from(a.horizon_deg)).toEqual(Array.from(sampleDataset.bySite[a.id].horizon_deg))
  })
})
