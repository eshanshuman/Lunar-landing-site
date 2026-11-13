import { dataset } from '../data/dataset'

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
          <li>Sun and Earth positions: synthetic today. Planned: JPL Horizons, hourly, no atmosphere.</li>
          <li>Terrain skylines: synthetic today. Planned: LOLA South Pole elevation model, 720 directions per site.</li>
          <li>Moon colour and relief: NASA SVS CGI Moon Kit (LRO camera and LOLA), public domain.</li>
          <li>Site coordinates: published values carried over from the prototype, not yet verified.</li>
        </ul>
      </details>
    </section>
  )
}
