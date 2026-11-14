import { dataset, gridFor, gridSource } from '../data/dataset'
import { useStore } from '../state/store'

/** "LDEM_80S_20MPP_ADJ.tiff (…)" -> 20. The pixel size is in the product's own file name. */
const metresPerPixel = (dem: string) => {
  const m = /_(\d+)MPP/.exec(dem)
  return m ? +m[1] : null
}
const utc = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`

// Fixed facts that are not in the loaded data. Sources: project-memory/facts.md and SOURCES.md.
const HORIZONS_CROSS_CHECK_DEG = 0.01 // Horizons vs our DE421 + IAU orientation run, six dates, ridge and degerl
const TILE_KM = 20
const TILE_PX = 512
const SKYLINE_DIRECTIONS = 720
const SKYLINE_REACH_KM = 150

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </>
  )
}

/** What is real, how exact it is, and what the tool does not model. Every number is read from the loaded data or cited. */
export default function DataNote() {
  useStore((s) => s.gridTick) // redraw when the Sunlight-map grids arrive
  const sample = dataset.source === 'sample'

  // Group the sites by the terrain file their skyline came from.
  const byRes = new Map<number, string[]>()
  for (const s of dataset.sites) {
    const r = metresPerPixel(dataset.bySite[s.id].meta.dem)
    if (r !== null) byRes.set(r, [...(byRes.get(r) ?? []), s.name])
  }
  const any = dataset.bySite[dataset.sites[0].id]
  const steps = any.sun.el.length
  const stepMin = any.step_h * 60
  const start = Date.parse(any.start_utc)
  const end = start + (steps - 1) * any.step_h * 36e5
  const grid = dataset.sites.map((s) => gridFor(s.id)).find((g) => g)
  const gridRes = grid ? metresPerPixel(grid.meta.dem) : null

  return (
    <section className="card">
      <h2>About the data</h2>
      {sample ? (
        <p className="note mt-3">
          <b>The numbers on this page are sample data.</b> You opened the sample view. The Sun and Earth tracks and the
          terrain skylines are generated stand-ins with realistic shapes, not measurements. Remove "?sample" from the
          address to see the real data.
        </p>
      ) : (
        <>
          <p className="note mt-3">
            <b>Sun, Earth and terrain are real.</b> Positions come from NASA JPL Horizons and terrain from NASA's LOLA
            laser altimeter. Landing dates in {new Date(start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}{' '}
            are a planning scenario, not an announced mission.
          </p>
          <dl className="facts">
            <Row k="Time covered">
              {utc(start)} to {utc(end)}: {steps.toLocaleString('en-GB')} steps, one every {stepMin} minutes ({Math.round((steps * any.step_h) / 24)} days).
            </Row>
            <Row k="Timing error">
              Up to ±{stepMin / 2} minutes on every sunrise, sunset and countdown, because visibility is checked once
              per step and the change can fall anywhere between two steps.
            </Row>
            <Row k="Position check">
              JPL Horizons azimuth and elevation agree with our own independent calculation to within{' '}
              {HORIZONS_CROSS_CHECK_DEG}° (six dates, two sites).
            </Row>
            <Row k="Skylines">
              {SKYLINE_DIRECTIONS} directions around each site, traced out to {SKYLINE_REACH_KM} km, seen from{' '}
              {any.meta.observer_height_m} m above the ground, with no atmosphere.
            </Row>
            {[...byRes.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([res, names]) => (
                <Row key={res} k={`Terrain, ${res} m`}>
                  Site skylines for {names.join(', ')}. These decide the verdict, the timeline and the landing-date grid.
                </Row>
              ))}
            <Row k={`Terrain, ${gridRes ?? '…'} m`}>
              {gridSource === 'sample'
                ? 'The Sunlight map is showing sample data.'
                : 'The Sunlight map. Coarser than the site skylines, so it can differ from the verdict for the same spot; the map says by how much.'}
            </Row>
            <Row k={`Terrain, ${Math.round((TILE_KM * 1000) / TILE_PX)} m`}>
              The 3D shadow view: {TILE_KM} km tiles of {TILE_PX} pixels, averaged from the 20 m model. It only casts
              shadows from ground inside the tile.
            </Row>
            <Row k="Site coordinates">
              Not yet checked against published papers. Shackleton rim was moved 1.9 km onto the rim crest by us, using
              the terrain model. Treat every site as an example point, not an official landing site.
            </Row>
          </dl>
        </>
      )}
      <p className="note mt-3">
        <b>The Moon you see is real.</b> Colour and relief come from NASA's Scientific Visualization Studio CGI Moon
        Kit. The global map smears close to the poles.
      </p>
      <p className="note mt-3">
        <b>In view means a clear line of sight over the terrain.</b> It does not promise power or a radio link. Link
        budgets, thermal limits, slopes, hazards and relays are not modelled.
      </p>
      <details className="sources">
        <summary>Sources and status</summary>
        <ul>
          <li>Sun and Earth positions: {sample ? 'synthetic (sample view).' : 'JPL Horizons API, observer table for a surface site on the Moon, airless apparent azimuth and elevation.'}</li>
          <li>
            Terrain: {sample ? 'synthetic (sample view).' : 'LOLA south pole elevation models LDEM_80S_20MPP_ADJ, LDEM_80S_80MPP_ADJ and LDEM_60S_60MPP_ADJ, PGDA product 90 (Barker et al. 2023, Planet. Sci. J., 4, 183).'}
          </li>
          <li>Moon colour and relief, and the intro's Earth: NASA Scientific Visualization Studio.</li>
          <li>Past landings: IM-1 and Chandrayaan-3 dates are from secondary sources (listed in the project's SOURCES file).</li>
          <li>Not done: validation of the sunlight results against a published LOLA illumination map.</li>
          <li>Full list with addresses and settings: SOURCES.md in the project repository.</li>
        </ul>
      </details>
    </section>
  )
}
