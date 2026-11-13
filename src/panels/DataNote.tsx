/** What the numbers are and are not (PLAN.md §9). Update when the pipeline data lands in M3. */
export default function DataNote() {
  return (
    <section className="card">
      <h2>Data</h2>
      <p className="note">
        This build uses <b style={{ color: 'var(--color-warn)' }}>synthetic sample data</b> with realistic shapes: the
        Sun circles the sky once per ~29.5 days at a height set by latitude, Earth wobbles slowly near the horizon
        (libration), and each skyline is generated, not measured. The pipeline swaps in JPL Horizons Sun/Earth
        positions and LOLA terrain horizons using the same data format. Site coordinates are published values still
        to be re-checked against NASA sources.
      </p>
      <p className="note mt-2">
        "Visible" means a clear geometric line of sight. It does not guarantee power or a radio link: link budgets,
        thermal limits, slopes, hazards and relays are not modelled.
      </p>
    </section>
  )
}
