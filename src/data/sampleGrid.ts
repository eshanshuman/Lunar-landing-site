/**
 * SYNTHETIC sample grid. Nothing in this file is a real measurement.
 *
 * Stands in for grid_<region>.json (41 x 41 points, 500 m apart, hourly Sun / Earth visibility bits)
 * until pipeline/build_grids.py has run on the real LOLA elevation model. The relief is a smooth
 * made-up surface; higher ground sees a lower skyline, and ground rising to one side blocks that side.
 * The centre point reproduces the site's own sample visibility exactly.
 */
import type { GridData, Site, SiteData } from '../types'
import { horizonAt } from '../lib/visibility'

export const SAMPLE_GRID_SIZE = 41
export const SAMPLE_GRID_SPACING_M = 500

const D2R = Math.PI / 180

function hash(s: string) {
  let h = 2166136261
  for (const c of s) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function rng(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildSampleGrid(site: Site, d: SiteData): GridData {
  const size = SAMPLE_GRID_SIZE
  const mid = (size - 1) / 2
  const hours = d.sun.el.length
  const r = rng(hash(`grid:${site.id}`))

  // Made-up relief: a few broad waves plus two crater-like bowls. Units: metres, scaled for the shading only.
  const waves = Array.from({ length: 5 }, () => ({ kx: (r() - 0.5) * 0.5, ky: (r() - 0.5) * 0.5, p: r() * 6.283, a: 0.25 + r() * 0.5 }))
  const bowls = Array.from({ length: 2 }, () => ({ x: (r() - 0.5) * size * 0.9, y: (r() - 0.5) * size * 0.9, w: 5 + r() * 7, a: 0.8 + r() * 0.8 }))
  const relief = (x: number, y: number) => {
    let v = 0
    for (const w of waves) v += w.a * Math.sin(w.kx * x + w.ky * y + w.p)
    for (const b of bowls) {
      const q = ((x - b.x) ** 2 + (y - b.y) ** 2) / (b.w * b.w)
      v += b.a * (0.55 * Math.exp(-((Math.sqrt(q) - 1) ** 2) * 6) - Math.exp(-q * 1.6)) // rim up, floor down
    }
    return v
  }
  const z = new Float32Array(size * size)
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) z[row * size + col] = relief(col - mid, mid - row)
  const at = (col: number, row: number) => z[Math.max(0, Math.min(size - 1, row)) * size + Math.max(0, Math.min(size - 1, col))]
  const slopeE = (col: number, row: number) => (at(col + 1, row) - at(col - 1, row)) / 2
  const slopeN = (col: number, row: number) => (at(col, row - 1) - at(col, row + 1)) / 2
  const z0 = at(mid, mid)
  const e0 = slopeE(mid, mid)
  const n0 = slopeN(mid, mid)

  // Per hour: the site's own skyline in the body's direction, and that direction's east / north parts.
  const perHour = (which: 'sun' | 'earth') => {
    const tr = d[which]
    const margin = new Float32Array(hours) // elevation above the site's skyline, degrees
    const sinA = new Float32Array(hours)
    const cosA = new Float32Array(hours)
    for (let h = 0; h < hours; h++) {
      margin[h] = tr.el[h] - horizonAt(d.horizon_deg, tr.az[h])
      sinA[h] = Math.sin(tr.az[h] * D2R)
      cosA[h] = Math.cos(tr.az[h] * D2R)
    }
    return { margin, sinA, cosA }
  }
  const bpp = Math.ceil(hours / 8)
  const pack = (which: 'sun' | 'earth') => {
    const { margin, sinA, cosA } = perHour(which)
    const bits = new Uint8Array(size * size * bpp)
    for (let row = 0; row < size; row++)
      for (let col = 0; col < size; col++) {
        const p = row * size + col
        // Skyline change at this point, degrees: lower when standing higher, higher towards rising ground.
        const lift = -0.9 * (z[p] - z0)
        const de = 2.2 * (slopeE(col, row) - e0)
        const dn = 2.2 * (slopeN(col, row) - n0)
        for (let h = 0; h < hours; h++) {
          if (margin[h] > lift + de * sinA[h] + dn * cosA[h]) bits[p * bpp + (h >> 3)] |= 1 << (h & 7)
        }
      }
    return bits
  }

  const height_m = new Float32Array(size * size)
  for (let p = 0; p < z.length; p++) height_m[p] = (z[p] - z0) * 400

  return {
    region: site.id,
    center: { lat: site.lat, lon: site.lon },
    spacing_m: SAMPLE_GRID_SPACING_M,
    size,
    start_utc: d.start_utc,
    step_h: d.step_h,
    hours,
    sun: pack('sun'),
    earth: pack('earth'),
    height_m,
    meta: { dem: 'SYNTHETIC (no DEM)', observer_height_m: 2, ephemeris: 'SYNTHETIC (not JPL Horizons)' },
  }
}
