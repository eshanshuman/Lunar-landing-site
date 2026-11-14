/**
 * The single place the app gets its data from. M3 swaps in pipeline JSON from public/data/
 * here and keeps the sample as the fallback.
 */
import type { Cell, Dataset, GridData, Site, SiteData } from '../types'
import { isCentre, pointBits, pointIndex } from '../lib/grid'
import { sampleDataset } from './sample'
import { buildSampleGrid } from './sampleGrid'
// Written by pipeline/build_dataset.py: real JPL Horizons tracks and LOLA skylines.
import real from '../../public/data/dataset.json'

type RealFile = {
  source: 'pipeline'
  start_utc: string
  days: number
  mission_lengths: number[]
  sites: Site[]
  bySite: Record<string, SiteData>
}

function fromPipeline(f: RealFile): Dataset {
  return {
    source: 'pipeline',
    sites: f.sites,
    bySite: f.bySite,
    startMs: Date.parse(f.start_utc),
    days: f.days,
    missionLengths: f.mission_lengths,
  }
}

/** Add ?sample to the URL to see the old synthetic data (for comparison only). */
const wantSample = typeof location !== 'undefined' && new URLSearchParams(location.search).has('sample')
export const dataset: Dataset = wantSample ? sampleDataset : fromPipeline(real as unknown as RealFile)

/**
 * Sunlight-map grids. Real ones are grid_<site>.json in public/data, written by
 * pipeline/build_grids.py from the LOLA 80 m elevation model. `?sample` keeps the synthetic ones.
 */
export const gridSource: 'sample' | 'pipeline' = wantSample ? 'sample' : 'pipeline'
export const siteById = (id: string) => dataset.sites.find((s) => s.id === id)!
export const dayMs = (day: number) => dataset.startMs + day * 864e5

/** Regions that have a Sunlight-map grid (PLAN.md: a grid around each Artemis region). */
const GRID_GROUP = 'Artemis study regions'
export const hasGrid = (siteId: string) => siteById(siteId).group === GRID_GROUP

type GridState = GridData | 'loading' | 'error'
const grids = new Map<string, GridState>()
const listeners = new Set<() => void>()
/** Called whenever a grid finishes loading (or fails), so views can redraw. */
export function onGridsChanged(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** The shape of grid_<region>.json on disk: bits as base64, heights possibly null where the DEM has holes. */
export interface GridFile extends Omit<GridData, 'sun' | 'earth' | 'height_m'> {
  sun_bits: string
  earth_bits: string
  height_m?: (number | null)[]
}

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** grid_<region>.json -> GridData. Throws if the file does not match its own header or the app's window. */
export function gridFromFile(f: GridFile, expectHours?: number): GridData {
  const { sun_bits, earth_bits, height_m, ...rest } = f
  const sun = bytesFromBase64(sun_bits)
  const earth = bytesFromBase64(earth_bits)
  const want = f.size * f.size * Math.ceil(f.hours / 8)
  if (sun.length !== want || earth.length !== want) throw new Error(`grid ${f.region}: expected ${want} bytes of bits, got ${sun.length} / ${earth.length}`)
  if (expectHours !== undefined && f.hours !== expectHours) throw new Error(`grid ${f.region}: covers ${f.hours} h but the dataset has ${expectHours} h`)
  return { ...rest, sun, earth, height_m: height_m ? Float32Array.from(height_m, (v) => (v === null ? NaN : v)) : undefined }
}

/** Fetches every region's grid. Safe to call more than once. Does nothing in `?sample` mode. */
export function loadGrids(): void {
  if (gridSource === 'sample' || typeof fetch === 'undefined') return
  for (const s of dataset.sites) {
    if (s.group !== GRID_GROUP || grids.has(s.id)) continue
    grids.set(s.id, 'loading')
    const d = dataset.bySite[s.id]
    fetch(`${import.meta.env.BASE_URL}data/grid_${s.id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`grid_${s.id}.json: HTTP ${r.status}`)
        return r.json() as Promise<GridFile>
      })
      .then((f) => {
        if (f.start_utc !== d.start_utc) throw new Error(`grid ${s.id}: starts ${f.start_utc}, dataset starts ${d.start_utc}`)
        grids.set(s.id, gridFromFile(f, d.sun.el.length))
      })
      .catch((e) => {
        console.error(e)
        grids.set(s.id, 'error')
      })
      .finally(() => listeners.forEach((cb) => cb()))
  }
}

/** 'none' for a site outside the Artemis regions; otherwise where its grid is in loading. */
export function gridStatus(siteId: string): 'none' | 'loading' | 'error' | 'ready' {
  if (!hasGrid(siteId)) return 'none'
  if (gridSource === 'sample') return 'ready'
  const g = grids.get(siteId)
  return g === undefined || g === 'loading' ? 'loading' : g === 'error' ? 'error' : 'ready'
}

/** The grid around a site, or null if it has none or it has not loaded yet. */
export function gridFor(siteId: string): GridData | null {
  if (!hasGrid(siteId)) return null
  if (gridSource === 'sample' && !grids.has(siteId)) grids.set(siteId, buildSampleGrid(siteById(siteId), dataset.bySite[siteId]))
  const g = grids.get(siteId)
  return g && typeof g === 'object' ? g : null
}

const cellData = new Map<string, SiteData>()

/**
 * The data every panel reads: the named site, or a point picked on its Sunlight map.
 * A map point keeps the site's Sun / Earth tracks (an approximation over a few km) and takes
 * its visibility from the grid's bits. It has no skyline of its own.
 */
export function dataFor(siteId: string, cell: Cell | null): SiteData {
  const base = dataset.bySite[siteId]
  const g = cell ? gridFor(siteId) : null
  if (!cell || !g || isCentre(g, cell)) return base
  const key = `${siteId}@${cell.col},${cell.row}`
  let d = cellData.get(key)
  if (!d) {
    const p = pointIndex(g, cell)
    d = { ...base, id: key, vis: { sun: pointBits(g, 'sun', p), earth: pointBits(g, 'earth', p) } }
    cellData.set(key, d)
  }
  return d
}
