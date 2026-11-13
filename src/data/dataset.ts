/**
 * The single place the app gets its data from. M3 swaps in pipeline JSON from public/data/
 * here and keeps the sample as the fallback.
 */
import type { Dataset } from '../types'
import { sampleDataset } from './sample'

export const dataset: Dataset = sampleDataset
export const siteById = (id: string) => dataset.sites.find((s) => s.id === id)!
export const dayMs = (day: number) => dataset.startMs + day * 864e5
