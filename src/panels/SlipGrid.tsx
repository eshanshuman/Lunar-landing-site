import { useMemo, useState } from 'react'
import { dataset, dayMs } from '../data/dataset'
import { fmtDate, pct } from '../lib/format'
import { status, windowStats } from '../lib/visibility'
import { useStore } from '../state/store'
import Tooltip, { type TipState } from './Tooltip'

const DAYS = Array.from({ length: dataset.days }, (_, d) => d)

export default function SlipGrid() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const pinA = useStore((s) => s.pinA)
  const selectScenario = useStore((s) => s.selectScenario)
  const [tip, setTip] = useState<TipState | null>(null)

  const stats = useMemo(
    () => dataset.sites.map((s) => DAYS.map((d) => windowStats(dataset.bySite[s.id], d * 24, missionLength * 24))),
    [missionLength],
  )

  return (
    <section className="card" id="slip">
      <h2>
        What if we slip?
        <span className="sub">
          Every site against every landing date, for a {missionLength}-day mission. Pick a square to load it.
        </span>
      </h2>
      {/* Scrolls sideways on narrow screens instead of widening the page. Padding keeps the selection outline unclipped. */}
      <div className="-m-1 overflow-x-auto p-1">
      <div className="grid-slip" style={{ gridTemplateColumns: `minmax(96px, 160px) repeat(${dataset.days}, minmax(14px, 1fr))` }}>
        {dataset.sites.map((s, r) => (
          <div key={s.id} className="contents">
            <div className={`rl${s.id === site ? ' on' : ''}`}>{s.name}</div>
            {DAYS.map((d) => {
              const st = stats[r][d]
              const sel = s.id === site && d === landingDay
              const pinned = pinA && pinA.site === s.id && pinA.landingDay === d && pinA.missionLength === missionLength
              return (
                <button
                  key={d}
                  className={`cell g${status(st)}${sel ? ' sel' : ''}${pinned ? ' pin' : ''}`}
                  aria-label={`${s.name}, land ${fmtDate(dayMs(d))}: sunlight ${pct(st.sunF)}%, Earth contact ${pct(st.earthF)}%${pinned ? ' (plan A)' : ''}`}
                  aria-pressed={sel}
                  onClick={() => selectScenario(s.id, d)}
                  onMouseMove={(e) =>
                    setTip({
                      x: e.clientX,
                      y: e.clientY,
                      content: (
                        <>
                          <b>{s.name}</b>
                          <br />
                          Land {fmtDate(dayMs(d))} · {missionLength}-day mission
                          <br />
                          <span className="text-sun">Sunlight {pct(st.sunF)}%</span> · longest dark {st.maxDark} h
                          <br />
                          <span className="text-earth">Earth contact {pct(st.earthF)}%</span> · longest gap {st.maxGap} h
                        </>
                      ),
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
              )
            })}
          </div>
        ))}
        <div className="cl" style={{ textAlign: 'left' }}>
          Landing day, {new Date(dayMs(0)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
        </div>
        {DAYS.map((d) => (
          <div key={d} className={`cl${d === landingDay ? ' on' : ''}`}>
            {d % 3 === 0 || d === landingDay ? new Date(dayMs(d)).getUTCDate() : ''}
          </div>
        ))}
      </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted">
        <span><span className="sw g2" />Sunlight and Earth link both at least 75% of the time</span>
        <span><span className="sw g1" />One falls short</span>
        <span><span className="sw g0" />Both fall short</span>
      </div>
      <Tooltip tip={tip} />
    </section>
  )
}
