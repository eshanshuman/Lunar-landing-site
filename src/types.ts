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
  /**
   * Optional precomputed visibility, one bit per step (LSB first). When present it wins over
   * comparing the tracks with `horizon_deg`. Used for map points, which store bits but no skyline.
   */
  vis?: { sun: Uint8Array; earth: Uint8Array }
}

/**
 * grid_<region>.json: hourly Sun / Earth visibility on a square grid of points around a site
 * (the Sunlight map and "nearest better point").
 *
 * Points are row-major from the north-west corner: row 0 is the northern edge, column 0 the western.
 * Point (row, col) sits ((col - c) * spacing_m) east and ((c - row) * spacing_m) north of the centre,
 * with c = (size - 1) / 2, in the tangent plane at the centre site.
 * Each point owns ceil(hours / 8) bytes; hour h is bit (h & 7) of byte (h >> 3), LSB first.
 * In the JSON file `sun_bits` / `earth_bits` are base64 of those bytes; in memory they are Uint8Array.
 */
export interface GridData {
  region: string
  center: { lat: number; lon: number }
  spacing_m: number
  /** Points per side (41 gives 41 x 41 points, 20 km across at 500 m). */
  size: number
  start_utc: string
  step_h: number
  hours: number
  sun: Uint8Array
  earth: Uint8Array
  /** Ground height at each point, metres. Only used to shade the map's backdrop. */
  height_m?: ArrayLike<number>
  meta: {
    dem: string
    observer_height_m: number
    ephemeris: string
    /** Share of hours (0..1) in which the grid's centre point matches the site's own, finer skyline. */
    centre_agreement?: { sun: number; earth: number } | null
  }
}

/** A point on a region's grid. */
export interface Cell {
  col: number
  row: number
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
