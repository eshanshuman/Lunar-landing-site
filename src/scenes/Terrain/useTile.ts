import { useEffect, useState } from 'react'
import type { Tile } from '../../lib/terrainShadow'
import { loadTile } from './loadTile'

/** The terrain tile for a site: the tile, null if the site has none, or where loading stands. */
export function useTile(site: string): Tile | null | 'loading' | 'error' {
  const [tile, setTile] = useState<Tile | null | 'loading' | 'error'>('loading')
  useEffect(() => {
    let live = true
    setTile('loading')
    loadTile(site).then(
      (x) => live && setTile(x),
      () => live && setTile('error'),
    )
    return () => {
      live = false
    }
  }, [site])
  return tile
}
