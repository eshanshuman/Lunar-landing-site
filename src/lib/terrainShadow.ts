/**
 * Terrain tiles (public/data/tile_<site>.png + .json) and the line-of-sight test inside one.
 *
 * A tile is a square of the LOLA DEM on the south polar stereographic grid: row 0 is the top of
 * the grid (largest grid y), column 0 the left. Tile coordinates here are metres from the tile
 * centre: x to the right, y up the grid. Grid "up" is not north; `grid_north_to_true_north_deg`
 * is the clockwise angle from grid up to true north at the centre.
 *
 * Heights are relative to the lunar sphere, so over a distance d the ground falls away from the
 * observer's horizontal plane by d^2 / (2R). The test below includes that drop, and the 3D mesh
 * applies the same drop, so the two agree by construction.
 */
import type { SiteData } from '../types'
import { isVisible, type Body } from './visibility'

export interface TileMeta {
  site: string
  centre_lat: number
  centre_lon: number
  size_m: number
  px: number
  h_min_m: number
  h_max_m: number
  grid_north_to_true_north_deg: number
  dem: string
  sphere_r_m: number
}

export interface Tile {
  meta: TileMeta
  /** px * px heights in metres above the sphere, row-major from the top-left. */
  heights: Float32Array
}

const D2R = Math.PI / 180

/** PNG value (0..65535) to metres: the inverse of the pipeline's quantisation. */
export function heightsFromU16(u16: ArrayLike<number>, meta: TileMeta): Float32Array {
  const out = new Float32Array(u16.length)
  const k = (meta.h_max_m - meta.h_min_m) / 65535
  for (let i = 0; i < out.length; i++) out[i] = meta.h_min_m + u16[i] * k
  return out
}

export const cellSize = (t: Tile) => t.meta.size_m / t.meta.px

/** Bilinear height at (x, y) metres from the centre; null outside the tile. */
export function heightAt(t: Tile, x: number, y: number): number | null {
  const { px, size_m } = t.meta
  const c = size_m / px
  const fx = (x + size_m / 2) / c - 0.5 // column of pixel centres
  const fy = (size_m / 2 - y) / c - 0.5 // row
  if (fx < 0 || fy < 0 || fx > px - 1 || fy > px - 1) return null
  const j = Math.min(px - 2, Math.floor(fx))
  const i = Math.min(px - 2, Math.floor(fy))
  const u = fx - j
  const v = fy - i
  const h = t.heights
  const a = h[i * px + j], b = h[i * px + j + 1], d = h[(i + 1) * px + j], e = h[(i + 1) * px + j + 1]
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + d * (1 - u) * v + e * u * v
}

/** Unit direction in tile (x, y) of a Horizons azimuth (degrees clockwise from true north). */
export function tileDirection(meta: TileMeta, azDeg: number): [number, number] {
  const phi = (azDeg + meta.grid_north_to_true_north_deg) * D2R
  return [Math.sin(phi), Math.cos(phi)]
}

/** How far the sphere has dropped below the horizontal plane at ground distance d, metres. */
export const curvatureDrop = (d: number, r: number) => (d * d) / (2 * r)

/**
 * Does terrain inside the tile hide a far-away body at (az, el) from an observer standing
 * `observerHeight` metres above the ground at the tile centre?
 */
export function tileBlocks(t: Tile, azDeg: number, elDeg: number, observerHeight = 2): boolean {
  const [dx, dy] = tileDirection(t.meta, azDeg)
  const step = cellSize(t)
  const eye = (heightAt(t, 0, 0) ?? 0) + observerHeight
  const slope = Math.tan(elDeg * D2R)
  for (let d = step; ; d += step) {
    const h = heightAt(t, dx * d, dy * d)
    if (h === null) return false // left the tile without meeting ground
    if (h - eye - curvatureDrop(d, t.meta.sphere_r_m) > d * slope) return true
  }
}

/**
 * The 3D view only knows the tile; the verdict comes from the 150 km skyline. Four cases:
 *  - lit:      both say the body is in view
 *  - near:     blocked, and terrain inside the tile is what blocks it (the 3D view shows it)
 *  - far:      blocked by a ridge beyond the tile (the 3D view cannot show that shadow)
 *  - mismatch: the tile says blocked but the skyline says in view; should be rare with real data
 */
export type Agreement = 'lit' | 'near' | 'far' | 'mismatch'

export function classify(maskVisible: boolean, tileBlocked: boolean): Agreement {
  if (maskVisible) return tileBlocked ? 'mismatch' : 'lit'
  return tileBlocked ? 'near' : 'far'
}

export function agreementAt(t: Tile, d: SiteData, body: Body, i: number): Agreement {
  return classify(isVisible(d, body, i), tileBlocks(t, d[body].az[i], d[body].el[i], d.meta.observer_height_m))
}

export type AgreementCounts = Record<Agreement, number> & { n: number }

/** Hours in each case over [start, start + length). */
export function compareOverWindow(t: Tile, d: SiteData, body: Body, start: number, length: number): AgreementCounts {
  const end = Math.min(start + length, d[body].el.length)
  const out: AgreementCounts = { lit: 0, near: 0, far: 0, mismatch: 0, n: Math.max(0, end - start) }
  for (let i = start; i < end; i++) out[agreementAt(t, d, body, i)]++
  return out
}
