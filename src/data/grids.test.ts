import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bit, centreCell, pointIndex, visibleHours } from '../lib/grid'
import { isVisible } from '../lib/visibility'
import { dataset, gridFromFile, type GridFile } from './dataset'

/** The real grids shipped in public/data, read the way the app reads them. */
const REGIONS = ['ridge', 'shack', 'degerl', 'peak', 'nobile']
const file = (id: string) => `public/data/grid_${id}.json`
const read = (id: string) => JSON.parse(readFileSync(file(id), 'utf8')) as GridFile & { meta: { centre_agreement: { sun: number; earth: number } } }

describe('gridFromFile', () => {
  const tiny: GridFile = {
    region: 't', center: { lat: -89, lon: 0 }, spacing_m: 500, size: 1, start_utc: '2028-10-01T00:00:00Z', step_h: 1, hours: 10,
    sun_bits: btoa(String.fromCharCode(0b00000101, 0b00000010)), earth_bits: btoa(String.fromCharCode(0, 0)), height_m: [null],
    meta: { dem: 'test', observer_height_m: 2, ephemeris: 'test' },
  }
  it('decodes base64 bits, LSB first, and turns DEM holes into NaN', () => {
    const g = gridFromFile(tiny)
    expect([0, 1, 2, 8, 9].map((h) => bit(g, 'sun', 0, h))).toEqual([true, false, true, false, true])
    expect(Number.isNaN(g.height_m![0])).toBe(true)
  })
  it('rejects a file whose bits do not match its header, or the wrong window length', () => {
    expect(() => gridFromFile({ ...tiny, hours: 20 })).toThrow(/bytes/)
    expect(() => gridFromFile(tiny, 1008)).toThrow(/1008/)
  })
})

const shipped = dataset.source === 'pipeline' && REGIONS.every((id) => existsSync(file(id)))

describe('shipped Sunlight-map grids', () => {
  it('are all present', () => {
    expect(REGIONS.filter((id) => !existsSync(file(id)))).toEqual([])
  })
  // Without the files there is nothing to read; the test above already reports that.
  for (const id of shipped ? REGIONS : []) {
    const d = dataset.bySite[id]
    const f = read(id)
    const g = gridFromFile(f, d.sun.el.length)

    it(`${id}: 41 x 41 points at 500 m covering the app's window`, () => {
      expect(g.region).toBe(id)
      expect(g.size).toBe(41)
      expect(g.spacing_m).toBe(500)
      expect(g.start_utc).toBe(d.start_utc)
      expect(g.hours).toBe(d.sun.el.length)
      expect(g.center.lat).toBeCloseTo(dataset.sites.find((s) => s.id === id)!.lat, 6)
      expect(g.height_m!.length).toBe(41 * 41)
      expect(g.meta.dem).toMatch(/LDEM_80S_80MPP_ADJ/)
    })

    it(`${id}: the recorded centre agreement is what the file and the dataset actually give`, () => {
      // The centre square is computed from the 80 m DEM like every other square. build_grids.py records
      // how often it matches the site's own 20 m skyline; recompute that here from the shipped bits.
      const p = pointIndex(g, centreCell(g))
      for (const body of ['sun', 'earth'] as const) {
        let same = 0
        for (let h = 0; h < g.hours; h++) if (bit(g, body, p, h) === isVisible(d, body, h)) same++
        expect(same / g.hours).toBeCloseTo(f.meta.centre_agreement[body], 3)
        // Measured on the 80 m file: 83% at degerl (Sun) is the worst. Much lower would mean a broken grid.
        expect(same / g.hours).toBeGreaterThan(0.8)
      }
    })

    it(`${id}: sunlight varies across the map and is never all-or-nothing by mistake`, () => {
      const h = visibleHours(g, 'sun', 0, g.hours)
      expect(Math.max(...h)).toBeGreaterThan(Math.min(...h))
      expect(Math.max(...h)).toBeLessThanOrEqual(g.hours)
    })
  }
})
