import { dataset, siteById } from '../data/dataset'
import { compass, pct } from '../lib/format'
import { horizonAt, sunVisible, windowStats } from '../lib/visibility'
import { useStore } from '../state/store'

/** Plain-language explanation generated from the data for the selected scenario. */
export default function Explain() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const d = dataset.bySite[site]
  const s0 = landingDay * 24
  const s1 = Math.min(s0 + missionLength * 24, d.sun.el.length)
  const st = windowStats(d, s0, missionLength * 24)

  let maxSun = -Infinity
  for (let i = s0; i < s1; i++) maxSun = Math.max(maxSun, d.sun.el[i])

  // The direction in which terrain hides the Sun for the most hours.
  const hits = new Uint16Array(360)
  for (let i = s0; i < s1; i++) if (!sunVisible(d, i)) hits[Math.floor(d.sun.az[i]) % 360]++
  let best = 0
  for (let a = 1; a < 360; a++) if (hits[a] > hits[best]) best = a

  return (
    <section className="card">
      <h2>Why</h2>
      <div className="explain">
        At <b>{siteById(site).name}</b> the Sun never climbs above <b>{maxSun.toFixed(1)}°</b> during this window.{' '}
        {st.maxDark > 0 ? (
          <>
            So terrain only <b>{horizonAt(d.horizon_deg, best).toFixed(1)}°</b> high to the <b>{compass(best)}</b> is
            enough to block it; the longest dark stretch is <b>{st.maxDark} h</b>.{' '}
          </>
        ) : (
          <>It stays above the skyline the whole time. </>
        )}
        Earth is visible <b>{pct(st.earthF)}%</b> of the time; it drifts up and down by several degrees each month
        (libration), which is why direct-to-Earth windows come and go.
      </div>
    </section>
  )
}
