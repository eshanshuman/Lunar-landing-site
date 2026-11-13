/** Shapes of the files in public/data/ (PLAN.md §6). */

export interface Site {
  id: string
  name: string
  group: string
  lat: number
  /** East longitude, degrees. */
  lon: number
  /** Height above the 1737.4 km reference sphere. Absent until verified. */
  alt_km?: number
  source: string
}

export interface Track {
  /** Degrees, clockwise from north. */
  az: ArrayLike<number>
  /** Degrees above the ideal (smooth-sphere) horizontal. */
  el: ArrayLike<number>
}

export interface SiteData {
  id: string
  start_utc: string
  step_h: number
  /** Terrain skyline, evenly spaced in azimuth from 0°, clockwise from north (720 values = 0.5° steps). */
  horizon_deg: ArrayLike<number>
  sun: Track
  earth: Track
  meta: { dem: string; observer_height_m: number; ephemeris: string }
}

export interface Dataset {
  source: 'sample' | 'pipeline'
  sites: Site[]
  bySite: Record<string, SiteData>
  /** UTC ms of the first landing-date column. */
  startMs: number
  /** Number of landing-date columns in the slip grid. */
  days: number
  missionLengths: number[]
}
