import { describe, expect, it } from 'vitest'
import type { GridData } from '../types'
import { sampleDataset } from '../data/sample'
import { buildSampleGrid, SAMPLE_GRID_SIZE, SAMPLE_GRID_SPACING_M } from '../data/sampleGrid'
import { bit, bytesPerPoint, cellOffset, centreCell, compassOf, describeMove, MIN_GAIN_H, nearestBetter, pointBits, pointIndex, visibleHours } from './grid'
import { isVisible, windowStats } from './visibility'

/** A size x size grid with `hours` hours; `lit(p, h)` says whether the Sun is in view. */
function grid(size: number, hours: number, lit: (p: number, h: number) => boolean): GridData {
  const bpp = Math.ceil(hours / 8)
  const sun = new Uint8Array(size * size * bpp)
  for (let p = 0; p < size * size; p++) for (let h = 0; h < hours; h++) if (lit(p, h)) sun[p * bpp + (h >> 3)] |= 1 << (h & 7)
  return {
    region: 't', center: { lat: -89, lon: 0 }, spacing_m: 500, size, start_utc: '2028-01-01T00:00:00Z', step_h: 1, hours,
    sun, earth: new Uint8Array(size * size * bpp), meta: { dem: 'test', observer_height_m: 2, ephemeris: 'test' },
  }
}

describe('bit packing', () => {
  const g = grid(3, 20, (p, h) => (p + h) % 3 === 0)
  it('gives each point whole bytes and reads hours LSB first', () => {
    expect(bytesPerPoint(g)).toBe(3)
    for (let p = 0; p < 9; p++) for (let h = 0; h < 20; h++) expect(bit(g, 'sun', p, h)).toBe((p + h) % 3 === 0)
  })
  it('hands out one point as a slice in the SiteData.vis layout', () => {
    const b = pointBits(g, 'sun', 4)
    expect(b.length).toBe(3)
    expect((b[1] >> 0) & 1).toBe(1) // hour 8: (4 + 8) % 3 === 0
    expect((b[0] >> 0) & 1).toBe(0) // hour 0
  })
  it('counts visible hours inside the window only, clipped to the data', () => {
    const all = grid(2, 30, () => true)
    expect(Array.from(visibleHours(all, 'sun', 0, 30))).toEqual([30, 30, 30, 30])
    expect(Array.from(visibleHours(all, 'sun', 10, 5))).toEqual([5, 5, 5, 5])
    expect(Array.from(visibleHours(all, 'sun', 25, 10))).toEqual([5, 5, 5, 5])
    expect(Array.from(visibleHours(all, 'earth', 0, 30))).toEqual([0, 0, 0, 0])
  })
})

describe('geometry', () => {
  const g = grid(5, 8, () => false)
  it('puts row 0 in the north and column 0 in the west', () => {
    expect(centreCell(g)).toEqual({ col: 2, row: 2 })
    expect(cellOffset(g, { col: 2, row: 2 })).toEqual({ east_m: 0, north_m: 0 })
    expect(cellOffset(g, { col: 4, row: 0 })).toEqual({ east_m: 1000, north_m: 1000 })
    expect(cellOffset(g, { col: 0, row: 3 })).toEqual({ east_m: -1000, north_m: -500 })
  })
  it('names compass directions', () => {
    expect(compassOf(0, 1)).toBe('N')
    expect(compassOf(1, 1)).toBe('NE')
    expect(compassOf(1, 0)).toBe('E')
    expect(compassOf(0, -1)).toBe('S')
    expect(compassOf(-1, -1)).toBe('SW')
    expect(compassOf(-1, 0.1)).toBe('W')
  })
  it('describes a move in km and direction', () => {
    expect(describeMove(g, { col: 4, row: 0 })).toEqual({ km: Math.hypot(1, 1), dir: 'NE' })
    expect(describeMove(g, { col: 0, row: 0 }, { col: 4, row: 0 })).toEqual({ km: 2, dir: 'W' })
  })
})

describe('nearestBetter', () => {
  const g = grid(5, 8, () => false)
  const ref = { col: 2, row: 2 }
  const hoursWith = (set: Record<number, number>, base = 100) => {
    const h = new Array(25).fill(base)
    for (const [p, v] of Object.entries(set)) h[+p] = v
    return h
  }
  it('returns null when nothing gains enough', () => {
    expect(nearestBetter(g, hoursWith({ 0: 100 + MIN_GAIN_H - 1 }), ref, 50)).toBeNull()
  })
  it('picks the closest point that gains at least MIN_GAIN_H when the site already passes', () => {
    // far corner gains a lot, a nearer point gains just enough: nearer wins
    const far = pointIndex(g, { col: 4, row: 0 })
    const near = pointIndex(g, { col: 3, row: 2 })
    const b = nearestBetter(g, hoursWith({ [far]: 200, [near]: 100 + MIN_GAIN_H }), ref, 50)
    expect(b).toMatchObject({ col: 3, row: 2, km: 0.5, dir: 'E', gain_h: MIN_GAIN_H })
  })
  it('aims for the pass line when the site fails, even if the gain is small', () => {
    const pass = pointIndex(g, { col: 2, row: 0 })
    const b = nearestBetter(g, hoursWith({ [pass]: 182 }, 178), ref, 180)
    expect(b).toMatchObject({ col: 2, row: 0, km: 1, dir: 'N', gain_h: 4 })
  })
  it('falls back to the best gain when no point reaches the pass line', () => {
    const p = pointIndex(g, { col: 1, row: 3 })
    expect(nearestBetter(g, hoursWith({ [p]: 130 }), ref, 999)).toMatchObject({ col: 1, row: 3, dir: 'SW', gain_h: 30 })
  })
  it('breaks distance ties with more hours and never returns the reference itself', () => {
    const e = pointIndex(g, { col: 3, row: 2 })
    const w = pointIndex(g, { col: 1, row: 2 })
    expect(nearestBetter(g, hoursWith({ [e]: 120, [w]: 140 }), ref, 50)).toMatchObject({ col: 1, row: 2 })
    // every point equal: the reference is as good as any, so there is nothing to suggest
    expect(nearestBetter(g, hoursWith({}), ref, 50)).toBeNull()
  })
  it('measures from a picked point, not always from the centre', () => {
    const p = pointIndex(g, { col: 4, row: 4 })
    expect(nearestBetter(g, hoursWith({ [p]: 150 }), { col: 4, row: 3 }, 50)).toMatchObject({ km: 0.5, dir: 'S', gain_h: 50 })
  })
})

describe('sample grid', () => {
  const site = sampleDataset.sites[0]
  const d = sampleDataset.bySite[site.id]
  const g = buildSampleGrid(site, d)
  it('has the grid_<region>.json shape: 41 x 41 points, 500 m apart, hourly bits', () => {
    expect(g.size).toBe(SAMPLE_GRID_SIZE)
    expect(g.size).toBe(41)
    expect(g.spacing_m).toBe(SAMPLE_GRID_SPACING_M)
    expect(g.hours).toBe(d.sun.el.length)
    expect(g.sun.length).toBe(41 * 41 * Math.ceil(g.hours / 8))
    expect(g.earth.length).toBe(g.sun.length)
    expect(g.height_m!.length).toBe(41 * 41)
    expect(g.meta.dem).toMatch(/SYNTHETIC/)
  })
  it('reproduces the site itself at the centre point', () => {
    const p = pointIndex(g, centreCell(g))
    for (let h = 0; h < g.hours; h++) {
      expect(bit(g, 'sun', p, h)).toBe(isVisible(d, 'sun', h))
      expect(bit(g, 'earth', p, h)).toBe(isVisible(d, 'earth', h))
    }
    expect(visibleHours(g, 'sun', 360, 240)[p]).toBe(windowStats(d, 360, 240).sun)
  })
  it('varies across the map', () => {
    const h = visibleHours(g, 'sun', 360, 240)
    expect(Math.max(...h)).toBeGreaterThan(Math.min(...h))
  })
})
