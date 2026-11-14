import { readFileSync, existsSync } from 'node:fs'
import { decode } from 'fast-png'
import { describe, expect, it } from 'vitest'
import { dataset } from '../data/dataset'
import { classify, compareOverWindow, groundAtSite, heightAt, heightsFromU16, tileBlocks, tileDirection, type Tile, type TileMeta } from './terrainShadow'

const R = 1_737_400

function tile(h: (x: number, y: number) => number, rot = 0, px = 201, size_m = 20_000): Tile {
  const heights = new Float32Array(px * px)
  const c = size_m / px
  for (let i = 0; i < px; i++) for (let j = 0; j < px; j++) heights[i * px + j] = h((j + 0.5) * c - size_m / 2, size_m / 2 - (i + 0.5) * c)
  const meta: TileMeta = { site: 't', centre_lat: -89, centre_lon: 0, size_m, px, h_min_m: 0, h_max_m: 1, grid_north_to_true_north_deg: rot, dem: 'test', sphere_r_m: R }
  return { meta, heights }
}

describe('tile geometry', () => {
  it('puts row 0 at the top of the grid and reads heights bilinearly', () => {
    const t = tile((x, y) => 2 * x + 3 * y) // a plane is reproduced exactly
    expect(heightAt(t, 0, 0)).toBeCloseTo(0, 6)
    expect(heightAt(t, 1000, -500)).toBeCloseTo(500, 3)
    expect(heightAt(t, 0, 9000)).toBeCloseTo(27000, 2)
    expect(heightAt(t, 10_001, 0)).toBeNull()
  })
  it('turns azimuth into tile axes with the grid rotation', () => {
    const check = (rot: number, az: number, x: number, y: number) => {
      const [dx, dy] = tileDirection({ grid_north_to_true_north_deg: rot } as TileMeta, az)
      expect(dx).toBeCloseTo(x, 9)
      expect(dy).toBeCloseTo(y, 9)
    }
    check(0, 0, 0, 1) // at lon 0, true north is grid up
    check(0, 90, 1, 0) // east is grid right
    check(90, 0, 1, 0) // at lon 90 E, true north is grid right
    check(90, 90, 0, -1) // and east is grid down
    check(222.51, 137.49, 0, 1)
  })
  it('decodes the 16-bit values with the tile range', () => {
    const meta = { h_min_m: -1000, h_max_m: 2000 } as TileMeta
    const h = heightsFromU16([0, 65535, 21845], meta)
    expect(h[0]).toBeCloseTo(-1000, 3)
    expect(h[1]).toBeCloseTo(2000, 3)
    expect(h[2]).toBeCloseTo(0, 3)
  })
})

describe('tileBlocks', () => {
  it('never blocks a body above the horizontal on flat ground', () => {
    const flat = tile(() => 1500)
    for (const az of [0, 77, 180, 301]) expect(tileBlocks(flat, az, 0.01)).toBe(false)
  })
  it('includes the curve of the Moon: from 2 m up the horizon dips about 0.087 degrees', () => {
    const flat = tile(() => 0)
    expect(tileBlocks(flat, 40, -0.05)).toBe(false) // above the dipped horizon
    expect(tileBlocks(flat, 40, -0.12)).toBe(true) // below it: the ground itself is in the way
  })
  it('is blocked by a wall up to the expected angle and only in its direction', () => {
    // 500 m wall 5 km towards grid +x. Top is seen at atan((500 - 2 - 5000^2 / 2R) / 5000) = 5.6 degrees.
    const wall = tile((x) => (x > 5000 && x < 5400 ? 500 : 0))
    const top = (Math.atan((500 - 2 - 5000 ** 2 / (2 * R)) / 5000) * 180) / Math.PI
    expect(top).toBeCloseTo(5.6, 1)
    expect(tileBlocks(wall, 90, top - 0.3)).toBe(true)
    expect(tileBlocks(wall, 90, top + 0.3)).toBe(false)
    expect(tileBlocks(wall, 270, 0.5)).toBe(false) // the other way is open
    // same wall, but the grid is rotated a quarter turn: the wall is now to true north
    const turned = { ...wall, meta: { ...wall.meta, grid_north_to_true_north_deg: 90 } }
    expect(tileBlocks(turned, 0, top - 0.3)).toBe(true)
    expect(tileBlocks(turned, 90, top - 0.3)).toBe(false)
  })
})

describe('classify', () => {
  it('names the four cases', () => {
    expect(classify(true, false)).toBe('lit')
    expect(classify(false, true)).toBe('near')
    expect(classify(false, false)).toBe('far') // blocked, but not by anything in the tile
    expect(classify(true, true)).toBe('mismatch')
  })
})

/** The shipped tiles, read the way the app reads them. */
function shipped(site: string): Tile | null {
  const base = `public/data/tile_${site}`
  if (!existsSync(`${base}.json`)) return null
  const meta = JSON.parse(readFileSync(`${base}.json`, 'utf8')) as TileMeta & { centre_height_m: number }
  const png = decode(readFileSync(`${base}.png`))
  expect(png.depth).toBe(16)
  expect(png.width).toBe(meta.px)
  return { meta, heights: heightsFromU16(png.data as Uint16Array, meta) }
}

describe('shipped tiles vs the horizon masks', () => {
  const ids = dataset.sites.map((s) => s.id).filter((id) => existsSync(`public/data/tile_${id}.json`))

  it('has a tile for each Artemis region, 512 px over 20 km, centred on the site', () => {
    expect(ids).toEqual(['ridge', 'shack', 'degerl', 'peak', 'nobile'])
    for (const id of ids) {
      const t = shipped(id)!
      const meta = t.meta as TileMeta & { centre_height_m: number }
      expect(meta.px).toBe(512)
      expect(meta.size_m).toBe(20000)
      expect(Math.abs((heightAt(t, 0, 0) ?? NaN) - meta.centre_height_m)).toBeLessThan(1)
    }
  })

  // Over the whole demo window: wherever the tile alone blocks the Sun or Earth, the 150 km skyline
  // must block it too, because the tile is part of that skyline. "far" hours are expected and fine.
  // Measured 2026-11-14 on the real October 2028 data: 0 mismatch hours at every site, both bodies.
  const window = (dataset.days + Math.max(...dataset.missionLengths)) * 24
  for (const id of ids)
    for (const body of ['sun', 'earth'] as const) {
      it(`${id}: tile never contradicts the skyline for the ${body} over the demo window`, () => {
        const c = compareOverWindow(shipped(id)!, dataset.bySite[id], body, 0, window)
        expect(c.lit + c.near + c.far + c.mismatch).toBe(c.n)
        expect(c.n).toBe(window)
        if (dataset.source === 'pipeline') expect(c.mismatch / c.n).toBeLessThan(0.01)
        // On the synthetic sample dataset the comparison is real ground against a made-up sky, so it is not asserted.
      })
    }

  it('stands the observer on the full-resolution ground height, not the averaged centre', () => {
    for (const id of ids) {
      const t = shipped(id)!
      expect(t.meta.site_height_m).toBeDefined()
      expect(groundAtSite(t)).toBeGreaterThanOrEqual(heightAt(t, 0, 0)!)
      expect(groundAtSite(t) - heightAt(t, 0, 0)!).toBeLessThan(5)
    }
  })
})
