/**
 * Maths for the Sunlight map: reading the packed visibility bits of a grid_<region>.json,
 * counting visible hours per point, and finding the nearest point that does better.
 */
import type { Cell, GridData } from '../types'
import type { Body } from './visibility'

export const bytesPerPoint = (g: GridData) => Math.ceil(g.hours / 8)
export const pointIndex = (g: GridData, c: Cell) => c.row * g.size + c.col
export const centreCell = (g: GridData): Cell => ({ col: (g.size - 1) / 2, row: (g.size - 1) / 2 })
export const isCentre = (g: GridData, c: Cell) => c.col === (g.size - 1) / 2 && c.row === (g.size - 1) / 2

/** Is the body in view from point p at hour h? */
export function bit(g: GridData, body: Body, p: number, h: number): boolean {
  return ((g[body][p * bytesPerPoint(g) + (h >> 3)] >> (h & 7)) & 1) === 1
}

/** The packed bits of one point, in the layout `SiteData.vis` expects. */
export function pointBits(g: GridData, body: Body, p: number): Uint8Array {
  const n = bytesPerPoint(g)
  return g[body].subarray(p * n, (p + 1) * n)
}

/** Hours in view in [start, start + length) for every point. */
export function visibleHours(g: GridData, body: Body, start: number, length: number): Uint16Array {
  const end = Math.min(start + length, g.hours)
  const out = new Uint16Array(g.size * g.size)
  for (let p = 0; p < out.length; p++) {
    let n = 0
    for (let h = start; h < end; h++) if (bit(g, body, p, h)) n++
    out[p] = n
  }
  return out
}

/** Offset of a cell from the grid centre, metres east and north. */
export function cellOffset(g: GridData, c: Cell): { east_m: number; north_m: number } {
  const mid = (g.size - 1) / 2
  return { east_m: (c.col - mid) * g.spacing_m, north_m: (mid - c.row) * g.spacing_m }
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
/** Eight-point compass direction of an offset. */
export function compassOf(east_m: number, north_m: number): string {
  const az = (Math.atan2(east_m, north_m) * 180) / Math.PI
  return DIRS[((Math.round(az / 45) % 8) + 8) % 8]
}

/** "1.5 km NE" from one cell to another (from the centre when `from` is omitted). */
export function describeMove(g: GridData, to: Cell, from: Cell = centreCell(g)): { km: number; dir: string } {
  const a = cellOffset(g, from)
  const b = cellOffset(g, to)
  const e = b.east_m - a.east_m
  const n = b.north_m - a.north_m
  return { km: Math.hypot(e, n) / 1000, dir: compassOf(e, n) }
}

export interface Better extends Cell {
  km: number
  dir: string
  /** Extra hours in view over the mission, compared with the reference point. */
  gain_h: number
}

/** A move has to win at least this many hours to be worth suggesting. */
export const MIN_GAIN_H = 12

/**
 * The closest point that does meaningfully better than `ref`.
 * If `ref` is below `passHours` (the 75% line), the target is the closest point that reaches it;
 * failing that, or if `ref` already passes, it is the closest point with at least MIN_GAIN_H more hours.
 * Ties on distance go to the point with more hours. Null if nothing qualifies.
 */
export function nearestBetter(g: GridData, hours: ArrayLike<number>, ref: Cell, passHours: number): Better | null {
  const base = hours[pointIndex(g, ref)]
  const search = (ok: (h: number) => boolean): Cell | null => {
    let best: Cell | null = null
    let bestD = Infinity
    let bestH = -1
    for (let row = 0; row < g.size; row++)
      for (let col = 0; col < g.size; col++) {
        const h = hours[row * g.size + col]
        if (!ok(h)) continue
        const d = (col - ref.col) ** 2 + (row - ref.row) ** 2
        if (d === 0) continue
        if (d < bestD || (d === bestD && h > bestH)) {
          best = { col, row }
          bestD = d
          bestH = h
        }
      }
    return best
  }
  const hit =
    (base < passHours ? search((h) => h >= passHours && h - base >= 1) : null) ?? search((h) => h - base >= MIN_GAIN_H)
  if (!hit) return null
  return { ...hit, ...describeMove(g, hit, ref), gain_h: hours[pointIndex(g, hit)] - base }
}
