import { dataset } from '../data/dataset'
import { fmtDur } from '../lib/format'
import { nextFlip } from '../lib/visibility'
import { useStore } from '../state/store'

const SRC = dataset.source === 'sample' ? 'Sample data (synthetic), not a real value' : 'JPL Horizons + LOLA terrain horizon'

export default function RightNow() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const t = useStore((s) => s.t)
  const d = dataset.bySite[site]
  const i = Math.min(landingDay * 24 + t, d.sun.el.length - 1)
  const sf = nextFlip(d, i, 'sun')
  const ef = nextFlip(d, i, 'earth')

  return (
    <section className="card">
      <h2>
        Right now <span className="sub">terrain-blocked counts as set</span>
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div title={`Sun centre above the ideal horizontal. ${SRC}`}>
          <div className="lbl">Sun height</div>
          <div className="big text-sun">{d.sun.el[i].toFixed(1)}°</div>
        </div>
        <div title={`Earth centre above the ideal horizontal. ${SRC}`}>
          <div className="lbl">Earth height</div>
          <div className="big text-earth">{d.earth.el[i].toFixed(1)}°</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="count" title={`Time until the Sun crosses the terrain skyline. ${SRC}`}>
          <div className="lbl">{sf.now ? 'Sunset in' : 'Sunrise in'}</div>
          <div className={`v ${sf.now ? 'text-sun' : 'text-bad'}`}>{fmtDur(sf.h)}</div>
        </div>
        <div className="count" title={`Time until Earth crosses the terrain skyline. ${SRC}`}>
          <div className="lbl">{ef.now ? 'Earthset in' : 'Earthrise in'}</div>
          <div className={`v ${ef.now ? 'text-earth' : 'text-bad'}`}>{fmtDur(ef.h)}</div>
        </div>
      </div>
    </section>
  )
}
