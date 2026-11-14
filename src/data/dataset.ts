/**
 * The single place the app gets its data from. M3 swaps in pipeline JSON from public/data/
 * here and keeps the sample as the fallback.
 */
import type { Cell, Dataset, GridData, SiteData } from '../types'
import { isCentre, pointBits, pointIndex } from '../lib/grid'
import { sampleDataset } from './sample'
import { buildSampleGrid } from './sampleGrid'

export const dataset: Dataset = sampleDataset
export const siteById = (id: string) => dataset.sites.find((s) => s.id === id)!
export const dayMs = (day: number) => dataset.startMs + day * 864e5

/** Regions that have a Sunlight-map grid (PLAN.md: a grid around each Artemis region). */
const GRID_GROUP = 'Artemis study regions'
const grids = new Map<string, GridData | null>()

/** The grid around a site, or null if it has none. Built on first use and kept. */
export function gridFor(siteId: string): GridData | null {
  if (!grids.has(siteId)) {
    const s = siteById(siteId)
    grids.set(siteId, s.group === GRID_GROUP ? buildSampleGrid(s, dataset.bySite[siteId]) : null)
  }
  return grids.get(siteId)!
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
