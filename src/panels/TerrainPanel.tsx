import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { dataset, siteById } from '../data/dataset'
import { pct } from '../lib/format'
import { agreementAt, compareOverWindow, type Agreement, type Tile } from '../lib/terrainShadow'
import { isVisible } from '../lib/visibility'
import { loadTile } from '../scenes/Terrain/loadTile'
import { useStore } from '../state/store'

const TerrainScene = lazy(() => import('../scenes/Terrain/TerrainScene'))

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** "2.0° up" or "6.6° below level": elevation against the site's horizontal, not the terrain. */
const angle = (el: number) => (el >= 0 ? `${el.toFixed(1)}° up` : `${(-el).toFixed(1)}° below level`)

const NOW: Record<Agreement, { cls: string; text: string }> = {
  lit: { cls: 'text-sun', text: 'The lander is in sunlight.' },
  near: { cls: 'text-bad', text: 'The lander is in shadow. Terrain inside this tile is blocking the Sun, as the view shows.' },
  far: {
    cls: 'text-bad',
    text: 'The lander is in shadow from a far ridge beyond this tile. The view cannot draw that shadow, so the ground here may look lit.',
  },
  mismatch: {
    cls: 'text-bad',
    text: 'The 150 km skyline says the lander is lit, but terrain inside this tile blocks the Sun. The two disagree here; trust neither without checking.',
  },
}

/** 3D LOLA shadow predictor: real terrain around the site, lit from the Sun's direction at the scrubber time. */
export default function TerrainPanel() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const t = useStore((s) => s.t)
  const [tile, setTile] = useState<Tile | null | 'loading' | 'error'>('loading')
  const [exaggeration, setExaggeration] = useState(1)
  const webgl = useMemo(hasWebGL, [])
  const name = siteById(site).name
  // Always the named site: the tile is centred on it, not on a point picked on the Sunlight map.
  const d = dataset.bySite[site]
  const sample = dataset.source === 'sample'

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

  const ready = tile !== null && tile !== 'loading' && tile !== 'error'
  const i = Math.min(landingDay * 24 + t, d.sun.el.length - 1)
  const counts = useMemo(
    () => (ready ? compareOverWindow(tile, d, 'sun', landingDay * 24, missionLength * 24) : null),
    [ready, tile, d, landingDay, missionLength],
  )

  const heading = (
    <h2>
      Shadows on the ground
      <span className="tag-real">Terrain: real LOLA</span>
      {sample && <span className="tag-sample">Sun and Earth: sample data</span>}
      <span className="sub">
        The 20 km around {name} from NASA's LOLA elevation model, lit from where the Sun is at the time on the timeline.
        Play the timeline and the shadows move.
      </span>
    </h2>
  )

  if (!ready) {
    return (
      <>
        <section className="card" id="terrain">
          {heading}
          <p className="note">
            {tile === 'loading'
              ? 'Loading the terrain…'
              : tile === 'error'
                ? 'The terrain for this site could not be loaded. Reload the page to try again.'
                : `There is no terrain tile around ${name} yet. Tiles cover the Artemis study regions; pick one of those sites to see it.`}
          </p>
        </section>
        <div />
      </>
    )
  }

  const now = agreementAt(tile, d, 'sun', i)
  // With a sample sky there is no real verdict to agree or disagree with, so only say what the tile itself shows.
  const tileShades = now === 'near' || now === 'mismatch'
  const status = sample
    ? {
        cls: tileShades ? 'text-bad' : 'text-sun',
        text: tileShades
          ? 'With this sample Sun direction, terrain inside the tile shades the lander.'
          : 'With this sample Sun direction, nothing inside the tile shades the lander.',
      }
    : NOW[now]
  const sky = {
    sunAz: d.sun.az[i],
    sunEl: d.sun.el[i],
    earthAz: d.earth.az[i],
    earthEl: d.earth.el[i],
    sunClear: isVisible(d, 'sun', i),
    earthClear: isVisible(d, 'earth', i),
  }

  return (
    <>
      <section className="card" id="terrain">
        {heading}
        <div className="terrain-view">
          {webgl ? (
            <Suspense fallback={<div className="hero-msg">Loading the 3D view…</div>}>
              <TerrainScene tile={tile} sky={sky} exaggeration={exaggeration} />
            </Suspense>
          ) : (
            <div className="hero-msg">This view needs WebGL, which this browser is not providing.</div>
          )}
          {exaggeration !== 1 && <div className="terrain-flag">Heights exaggerated {exaggeration}×. Shadows are not to scale.</div>}
        </div>
        <p className={`terrain-now ${status.cls}`} aria-live="polite">
          {status.text}
        </p>
        <div className="legend">
          <span><i style={{ background: 'var(--color-sun)' }} />Line to the Sun ({angle(sky.sunEl)})</span>
          <span><i style={{ background: 'var(--color-earth)' }} />Line to Earth ({angle(sky.earthEl)})</span>
          <span><i style={{ background: 'var(--color-bad)' }} />Red and dashed: blocked by terrain</span>
          <span className="text-dim">The grey arrow on the edge points to true north. Drag to rotate, scroll to zoom.</span>
        </div>
      </section>

      <section className="card aside">
        <h2>Height scale</h2>
        <div className="seg" role="group" aria-label="Vertical exaggeration">
          {[1, 2, 3].map((x) => (
            <button key={x} aria-pressed={exaggeration === x} onClick={() => setExaggeration(x)}>
              {x === 1 ? 'True scale' : `${x}×`}
            </button>
          ))}
        </div>
        <p className="note mt-3">
          {exaggeration === 1
            ? 'Heights and distances are drawn to the same scale, so the shadows are the real geometry.'
            : `Heights are stretched ${exaggeration}× to make the relief easier to see. The shadows you see are then longer or shorter than the real ones. The verdict below the view is not affected.`}
        </p>

        <h2 className="mt-7">What this view can and cannot show</h2>
        <p className="note">
          Shadows here are cast only by terrain inside this 20 km square. Whether the lander is lit is decided separately,
          from the full skyline out to 150 km. Near the pole the Sun is so low that a ridge 100 km away can block it, and
          this view cannot draw that.
        </p>
        {counts && (
          <>
            <p className="note mt-3">Over this {missionLength}-day mission, hour by hour at the lander:</p>
            <div className="diff-row"><span>In sunlight</span><span className="d">{counts.lit} h</span></div>
            <div className="diff-row"><span>Shadow from terrain in this tile</span><span className="d">{counts.near} h</span></div>
            <div className="diff-row"><span>Shadow from a far ridge beyond it</span><span className="d">{counts.far} h</span></div>
            <div className="diff-row"><span>Tile and skyline disagree</span><span className={`d ${counts.mismatch ? 'down' : 'flat'}`}>{counts.mismatch} h ({pct(counts.n ? counts.mismatch / counts.n : 0)}%)</span></div>
          </>
        )}
        {sample && (
          <p className="note mt-3">
            <b>Not yet meaningful:</b> the terrain is real, but the Sun's path and the 150 km skyline are still sample
            data, so the Sun here is not where it will really be and the counts above compare real ground with a made-up
            sky. They become a real check when the pipeline data lands.
          </p>
        )}
      </section>
    </>
  )
}
