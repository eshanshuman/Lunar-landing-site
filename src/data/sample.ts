/**
 * SYNTHETIC sample data. Nothing in this file is a real measurement.
 *
 * Port of the generator in reference/prototype.html, emitting the PLAN.md §6 schema, so the
 * UI works before the pipeline lands. Anything rendered from it must show the "Sample data" badge.
 * Site coordinates are the prototype's published values and are still to be verified (PLAN.md §11).
 */
import type { Dataset, Site, SiteData } from '../types'

const COORD_SOURCE = 'Prototype value, to be verified against NASA sources (PLAN.md §11)'

export const SAMPLE_SITES: Site[] = [
  { id: 'ridge', name: 'Connecting ridge', lat: -89.4632, lon: -137.49, group: 'Artemis study regions', source: COORD_SOURCE },
  { id: 'shack', name: 'Shackleton rim', lat: -89.7668, lon: -171.87, group: 'Artemis study regions', source: COORD_SOURCE },
  { id: 'degerl', name: 'de Gerlache rim', lat: -88.6834, lon: -67.9321, group: 'Artemis study regions', source: COORD_SOURCE },
  { id: 'peak', name: 'Peak near Shackleton', lat: -88.811, lon: 123.6901, group: 'Artemis study regions', source: COORD_SOURCE },
  { id: 'nobile', name: 'Nobile rim 1', lat: -85.4381, lon: 37.3667, group: 'Artemis study regions', source: COORD_SOURCE },
  { id: 'im1', name: 'IM-1 · Malapert A', lat: -80.13, lon: 1.44, group: 'Past landings', source: COORD_SOURCE },
  { id: 'ch3', name: 'Chandrayaan-3', lat: -69.37, lon: 32.32, group: 'Past landings', source: COORD_SOURCE },
]

const START_MS = Date.UTC(2028, 0, 1, 0)
const DAYS = 28
const MISSION_LENGTHS = [3, 7, 10, 14]
const HOURS = (DAYS + Math.max(...MISSION_LENGTHS)) * 24

const D2R = Math.PI / 180
const SYN = 29.5306
const DRA = 27.2122
const ANO = 27.5546

function rng(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash(s: string) {
  let h = 2166136261
  for (const c of s) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const wrap360 = (x: number) => ((x % 360) + 360) % 360

export function buildSampleSite(site: Site): SiteData {
  const r = rng(hash(site.id))
  const colat = 90 - Math.abs(site.lat)

  // Skyline: smooth random ridges, generated at 1° like the prototype.
  const amp = (site.group === 'Artemis study regions' ? 0.9 : 1.6) * (0.8 + r() * 0.5)
  const comps = Array.from({ length: 6 }, (_, i) => ({
    k: i + 1 + Math.floor(r() * 3),
    a: (amp * (0.25 + r() * 0.6)) / (i * 0.6 + 1),
    p: r() * Math.PI * 2,
  }))
  const bumps = Array.from({ length: 3 }, () => ({ c: r() * 360, w: 12 + r() * 25, a: amp * (0.6 + r() * 0.9) }))
  const raw = new Float32Array(360)
  for (let a = 0; a < 360; a++) {
    let v = -0.55
    for (const c of comps) v += c.a * Math.max(0, Math.sin(c.k * a * D2R + c.p))
    for (const b of bumps) {
      const d = Math.min(Math.abs(a - b.c), 360 - Math.abs(a - b.c))
      v += b.a * Math.exp(-(d * d) / (2 * b.w * b.w))
    }
    raw[a] = v * 0.6
  }
  const smooth = new Float32Array(360)
  for (let a = 0; a < 360; a++) {
    let s = 0
    for (let k = -3; k <= 3; k++) s += raw[(a + k + 360) % 360]
    smooth[a] = s / 7
  }
  // Upsample to the schema's 720 values (0.5° steps). Linear, so the skyline is unchanged.
  const horizon = new Float32Array(720)
  for (let a = 0; a < 360; a++) {
    horizon[2 * a] = smooth[a]
    horizon[2 * a + 1] = (smooth[a] + smooth[(a + 1) % 360]) / 2
  }

  const sunPhase = r() * Math.PI * 2
  const decl0 = 0.2 + r() * 0.8
  const sunAz = new Float32Array(HOURS)
  const sunEl = new Float32Array(HOURS)
  const eAz = new Float32Array(HOURS)
  const eEl = new Float32Array(HOURS)
  const towardEarth = wrap360(180 - site.lon)
  for (let i = 0; i < HOURS; i++) {
    const d = i / 24
    const H = (2 * Math.PI * d) / SYN + sunPhase
    sunAz[i] = wrap360(H / D2R)
    const decl = decl0 + 0.9 * Math.sin((2 * Math.PI * d) / 365.25)
    sunEl[i] = decl + colat * Math.cos(H - towardEarth * D2R + Math.PI)
    const libLat = 6.7 * Math.sin((2 * Math.PI * d) / DRA)
    const libLon = 7.9 * Math.sin((2 * Math.PI * d) / ANO)
    eAz[i] = wrap360(towardEarth + libLon)
    eEl[i] = -libLat + colat * Math.cos((site.lon - libLon) * D2R)
  }

  return {
    id: site.id,
    start_utc: new Date(START_MS).toISOString(),
    step_h: 1,
    horizon_deg: horizon,
    sun: { az: sunAz, el: sunEl },
    earth: { az: eAz, el: eEl },
    meta: { dem: 'SYNTHETIC (no DEM)', observer_height_m: 2, ephemeris: 'SYNTHETIC (not JPL Horizons)' },
  }
}

export const sampleDataset: Dataset = {
  source: 'sample',
  sites: SAMPLE_SITES,
  bySite: Object.fromEntries(SAMPLE_SITES.map((s) => [s.id, buildSampleSite(s)])),
  startMs: START_MS,
  days: DAYS,
  missionLengths: MISSION_LENGTHS,
}
