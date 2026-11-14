import { useState } from 'react'
import { dataset, dayMs, siteById } from '../data/dataset'
import { fmtDT, fmtDur } from '../lib/format'
import { batteryWh, longestDark, skyBlockedFraction } from '../lib/night'
import { useSiteData, useStore } from '../state/store'

const fmtEnergy = (wh: number) => (wh >= 10000 ? `${(wh / 1000).toFixed(1)} kWh` : `${Math.round(wh).toLocaleString('en-GB')} Wh`)

/** Scope item 11: longest dark stretch from the data × the power the user enters = battery energy. */
export function NightPlanner() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const d = useSiteData()
  const [watts, setWatts] = useState('')
  const [margin, setMargin] = useState('')

  const mission = longestDark(d, landingDay * 24, missionLength * 24)
  const all = longestDark(d, 0, d.sun.el.length)
  const w = Number(watts)
  const m = margin === '' ? 0 : Number(margin)
  const valid = watts !== '' && Number.isFinite(w) && w > 0 && Number.isFinite(m) && m >= 0
  const at = (i: number | null) => (i === null ? '' : fmtDT(Date.parse(d.start_utc) + i * d.step_h * 36e5))
  const dataDays = Math.round((d.sun.el.length * d.step_h) / 24)

  return (
    <section className="card" id="night">
      <h2>
        Survive the night
        <span className="sub">
          How long the Sun stays behind the terrain at {siteById(site).name}, and the battery that would carry your
          lander through it. You enter the power; the darkness comes from the data.
        </span>
      </h2>

      <div className="diff-row">
        <span>Longest dark in your {missionLength}-day mission</span>
        <span className="lbl">
          {mission.hours === 0 ? 'The Sun never goes behind the terrain' : `${mission.open ? 'at least ' : ''}${fmtDur(mission.hours)}, from ${at(mission.start)}`}
        </span>
        <span />
      </div>
      <div className="diff-row">
        <span>Longest dark in all {dataDays} days of data</span>
        <span className="lbl">
          {all.hours === 0 ? 'None' : `${all.open ? 'at least ' : ''}${fmtDur(all.hours)}, from ${at(all.start)}`}
        </span>
        <span />
      </div>

      <div className="controls">
        <label className="field">
          <span>Standby and heater power</span>
          <span className="unit">
            <input inputMode="decimal" value={watts} onChange={(e) => setWatts(e.target.value)} placeholder="e.g. your lander's figure" />
            W
          </span>
        </label>
        <label className="field">
          <span>Safety margin</span>
          <span className="unit">
            <input inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} placeholder="0" />%
          </span>
        </label>
      </div>

      {valid ? (
        <div className="mt-4">
          <p className="text-lg">
            {mission.hours === 0 ? (
              <>No night to survive in this mission.</>
            ) : (
              <>
                Battery for this mission&rsquo;s night: <b>{fmtEnergy(batteryWh(w, mission.hours) * (1 + m / 100))}</b>
              </>
            )}
          </p>
          <p className="note mt-1">
            {mission.hours > 0 && `${w} W × ${mission.hours} h${m ? ` × ${1 + m / 100} margin` : ''}. `}
            {all.hours > mission.hours &&
              `To stay through the longest dark in the data (${fmtDur(all.hours)}) you would need ${fmtEnergy(batteryWh(w, all.hours) * (1 + m / 100))}${all.open ? ' or more' : ''}.`}
          </p>
        </div>
      ) : (
        <p className="note mt-4">Enter your lander&rsquo;s standby power to get the battery size. We don&rsquo;t assume one.</p>
      )}

      <p className="note mt-3 text-dim">
        Dark means the Sun&rsquo;s centre is behind the terrain, hour by hour, from JPL Horizons and the LOLA skyline. This
        is energy only: it ignores battery temperature, ageing, depth of discharge and any power from a low Sun at the edge.
        Landing {fmtDT(dayMs(landingDay)).slice(0, 10)}; data covers {dataset.days} landing dates plus the longest mission.
      </p>
    </section>
  )
}

/** Scope item 12: share of the sky hidden by the skyline. Geometry only. */
export function SkyBlocked() {
  const site = useStore((s) => s.site)
  const h = dataset.bySite[site].horizon_deg
  const f = skyBlockedFraction(h)
  let max = -Infinity, maxAz = 0
  for (let i = 0; i < h.length; i++) if (h[i] > max) [max, maxAz] = [h[i], (i * 360) / h.length]
  return (
    <section className="card aside">
      <h2>Sky hidden by terrain</h2>
      <p className="verdict" style={{ marginTop: 0 }}>{f * 100 < 0.1 ? '< 0.1' : (f * 100).toFixed(1)}%</p>
      <p className="note">
        of the sky above {siteById(site).name}&rsquo;s horizontal is hidden behind the skyline. The highest ridge stands{' '}
        {max.toFixed(1)}° up, toward azimuth {Math.round(maxAz)}°.
      </p>
      <p className="note mt-3 text-dim">
        Geometry only, from the LOLA skyline. It says how much sky the terrain covers, not what that means for radiation or
        heat.
      </p>
    </section>
  )
}
