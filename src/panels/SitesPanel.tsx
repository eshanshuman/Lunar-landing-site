import { Fragment } from 'react'
import { dataset } from '../data/dataset'
import { status, windowStats } from '../lib/visibility'
import { useStore } from '../state/store'

export default function SitesPanel() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const selectSite = useStore((s) => s.selectSite)
  const setMissionLength = useStore((s) => s.setMissionLength)

  let group: string | null = null
  return (
    <section className="card">
      <h2>Sites</h2>
      <div className="sites-list">
        {dataset.sites.map((s) => {
          const k = status(windowStats(dataset.bySite[s.id], landingDay * 24, missionLength * 24))
          const head = s.group !== group ? <div className="group-h">{s.group}</div> : null
          group = s.group
          return (
            <Fragment key={s.id}>
              {head}
              <button
                className={`site${s.id === site ? ' on' : ''}`}
                aria-pressed={s.id === site}
                title={`Coordinates: ${s.source}`}
                onClick={() => selectSite(s.id)}
              >
                <div className="nm">
                  <span className={`dot g${k}`} />
                  {s.name}
                </div>
                <div className="co">
                  {s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°E
                </div>
              </button>
            </Fragment>
          )
        })}
      </div>
      <label className="mt-3 flex items-center gap-2 text-[13px] text-muted">
        Mission length
        <select value={missionLength} onChange={(e) => setMissionLength(+e.target.value)}>
          {dataset.missionLengths.map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
