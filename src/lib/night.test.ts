import { describe, expect, it } from 'vitest'
import type { SiteData } from '../types'
import { batteryWh, longestDark, skyBlockedFraction } from './night'

/** Flat skyline at 0°, Sun due north at the given elevations. */
function site(sunEl: number[]): SiteData {
  return {
    id: 't',
    start_utc: '2028-01-01T00:00:00Z',
    step_h: 1,
    horizon_deg: new Array(720).fill(0),
    sun: { az: sunEl.map(() => 0), el: sunEl },
    earth: { az: sunEl.map(() => 0), el: sunEl.map(() => 5) },
    meta: { dem: 'test', observer_height_m: 2, ephemeris: 'test' },
  }
}

describe('longestDark', () => {
  it('finds the longest dark run', () => {
    const d = site([1, -1, -1, 1, -1, -1, -1, 1])
    expect(longestDark(d, 0, 8)).toEqual({ hours: 3, start: 4, open: false })
  })
  it('flags a run that reaches the end of the window', () => {
    const d = site([1, 1, -1, -1])
    expect(longestDark(d, 0, 4)).toEqual({ hours: 2, start: 2, open: true })
  })
  it('reports no night when the Sun never sets', () => {
    expect(longestDark(site([2, 2, 2]), 0, 3)).toEqual({ hours: 0, start: null, open: false })
  })
  it('only looks inside the window', () => {
    const d = site([-1, -1, -1, 1, 1, -1])
    expect(longestDark(d, 3, 2).hours).toBe(0)
  })
})

describe('skyBlockedFraction', () => {
  it('is zero for a flat or sunken skyline', () => {
    expect(skyBlockedFraction(new Array(720).fill(0))).toBe(0)
    expect(skyBlockedFraction(new Array(720).fill(-3))).toBe(0)
  })
  it('is sin(h) for a uniform skyline', () => {
    expect(skyBlockedFraction(new Array(720).fill(30))).toBeCloseTo(0.5, 10)
  })
  it('averages over azimuth', () => {
    const h = new Array(720).fill(0)
    for (let i = 0; i < 360; i++) h[i] = 90
    expect(skyBlockedFraction(h)).toBeCloseTo(0.5, 10)
  })
})

it('battery energy is power times hours', () => {
  expect(batteryWh(40, 100)).toBe(4000)
})
