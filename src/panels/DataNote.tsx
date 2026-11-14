import { dataset, gridSource } from '../data/dataset'

/** What is real, what is not, and what the tool does not model (PLAN.md §9). */
export default function DataNote() {
  const sample = dataset.source === 'sample'
  return (
    <section className="card">
      <h2>About the data</h2>
      {sample && (
        <p className="note mt-3">
          <b>The numbers on this page are sample data.</b> The Sun and Earth tracks and the terrain skylines are
          generated stand-ins with realistic shapes. They will be replaced by JPL Horizons positions and skylines from
          NASA's LOLA elevation model, in the same format.
        </p>
      )}
      {!sample && (
        <p className="note mt-3">
          <b>Sun, Earth and skylines are real.</b> Sun and Earth positions come from NASA JPL Horizons, hour by hour.
          Each site's skyline comes from NASA's LOLA elevation model (20 m per pixel at the Artemis sites), traced in 720
          directions out to 150 km. Landing dates in October 2028 are a planning scenario, not an announced mission.
          {gridSource === 'sample' && ' The Sunlight map is still sample data and carries a badge.'}
        </p>
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
          <li>Sun and Earth positions: {sample ? 'synthetic (?sample view).' : 'JPL Horizons API, hourly, no atmosphere, observer 2 m above the ground.'}</li>
          <li>Terrain skylines: {sample ? 'synthetic (?sample view).' : 'LOLA LDEM_80S_20MPP_ADJ (Artemis sites) and LDEM_60S_60MPP_ADJ (past landings), PGDA product 90 (Barker et al. 2023).'}</li>
          <li>Sunlight map: synthetic grid and relief today. Planned: the same LOLA model, 41 x 41 points every 500 m.</li>
          <li>Moon colour and relief: NASA SVS CGI Moon Kit (LRO camera and LOLA), public domain.</li>
          <li>Site coordinates: carried over from the prototype and not yet checked against published papers. Shackleton rim was moved 1.9 km onto the rim crest using the terrain model.</li>
        </ul>
      </details>
    </section>
  )
}
