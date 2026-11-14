import { decode } from 'fast-png'
import { heightsFromU16, type Tile, type TileMeta } from '../../lib/terrainShadow'

const BASE = import.meta.env.BASE_URL
const cache = new Map<string, Promise<Tile | null>>()

/** Loads public/data/tile_<site>.json + .png. Resolves to null for a site that has no tile. */
export function loadTile(site: string): Promise<Tile | null> {
  let p = cache.get(site)
  if (!p) {
    p = (async () => {
      const m = await fetch(`${BASE}data/tile_${site}.json`)
      // A missing file can come back as the app's own index page, so check the type as well as the status.
      if (!m.ok || !(m.headers.get('content-type') ?? '').includes('json')) return null
      const meta = (await m.json()) as TileMeta
      const img = await fetch(`${BASE}data/tile_${site}.png`)
      if (!img.ok) return null
      const png = decode(await img.arrayBuffer())
      if (png.depth !== 16 || png.width !== meta.px || png.height !== meta.px) throw new Error(`tile_${site}.png is not a ${meta.px} px 16-bit image`)
      return { meta, heights: heightsFromU16(png.data as Uint16Array, meta) }
    })()
    cache.set(site, p)
    p.catch(() => cache.delete(site))
  }
  return p
}
