import { Component, Fragment, lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { dataset, dayMs, siteById } from '../data/dataset'
import { fmtDur, pct } from '../lib/format'
import { nextFlip, OK_FRACTION, status, windowStats } from '../lib/visibility'
import { useStore } from '../state/store'
import Timeline from './Timeline'

const MoonScene = lazy(() => import('../scenes/Moon/MoonScene'))

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const NoWebGL = () => (
  <div className="hero-msg">
    The 3D Moon needs WebGL, which this browser is not providing.
    <br />
    Everything else on this page still works.
  </div>
)

const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const VERDICT = ['Poor window', '', 'Good window'] as const
const DOT = ['g0', 'g1', 'g2'] as const

/** First screen: the 3D Moon with one plain-language verdict for the chosen site and date. */
export default function Hero() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const t = useStore((s) => s.t)
  const selectSite = useStore((s) => s.selectSite)
  const selectScenario = useStore((s) => s.selectScenario)
  const setMissionLength = useStore((s) => s.setMissionLength)
  const [recentre, setRecentre] = useState(0)
  const webgl = useMemo(hasWebGL, [])

  const s = siteById(site)
  const d = dataset.bySite[site]
  const st = windowStats(d, landingDay * 24, missionLength * 24)
  const k = status(st)
  const i = Math.min(landingDay * 24 + t, d.sun.el.length - 1)
  const sf = nextFlip(d, i, 'sun')
  const ef = nextFlip(d, i, 'earth')
  const verdict = k === 1 ? (st.sunF < OK_FRACTION ? 'Not enough sunlight' : 'Earth link drops out') : VERDICT[k]
  const src = dataset.source === 'sample' ? 'Sample data, not a real value.' : ''
  const until = (h: number | null, soon: string) => (h === null ? 'for the rest of the data' : `${soon} ${fmtDur(h)}`)

  let group: string | null = null
  return (
    <section className="hero">
      <div className="hero-canvas">
        {webgl ? (
          <Boundary fallback={<NoWebGL />}>
            <Suspense fallback={<div className="hero-msg">Loading the Moon…</div>}>
              <MoonScene recentre={recentre} />
            </Suspense>
          </Boundary>
        ) : (
          <NoWebGL />
        )}
      </div>

      <header className="hero-top">
        <span className="wordmark">Lunar Landing Site Navigator</span>
        {dataset.source === 'sample' && (
          <span
            className="badge"
            title="The Sun and Earth tracks and the terrain skylines are synthetic stand-ins. Real JPL Horizons and LOLA data replace them when the pipeline lands. The Moon imagery is real."
          >
            Sample data, not real values
          </span>
        )}
      </header>

      <div className="hero-left">
        <h1>{s.name}</h1>
        <div className="verdict" aria-live="polite">
          <span className={`dot ${DOT[k]}`} />
          {verdict}
        </div>
        <p className="lede">
          Land on <b>{longDate(dayMs(landingDay))}</b> and stay <b>{missionLength} days</b>.
        </p>

        <div className="meter" title={`Share of the mission with the Sun above the terrain. A good window needs ${pct(OK_FRACTION)}%. ${src}`}>
          <div className="meter-head">
            Sunlight <b>{pct(st.sunF)}%</b>
          </div>
          <div className="meter-bar">
            <i style={{ width: `${st.sunF * 100}%`, background: 'var(--color-sun)' }} />
          </div>
        </div>
        <div className="meter" title={`Share of the mission with Earth above the terrain. A good window needs ${pct(OK_FRACTION)}%. ${src}`}>
          <div className="meter-head">
            Direct link to Earth <b>{pct(st.earthF)}%</b>
          </div>
          <div className="meter-bar">
            <i style={{ width: `${st.earthF * 100}%`, background: 'var(--color-earth)' }} />
          </div>
        </div>

        <p className="lede mt-4">
          {sf.now ? <>Sun in view, {until(sf.h, 'sets in')}.</> : <>Sun behind terrain, {until(sf.h, 'rises in')}.</>}{' '}
          {ef.now ? <>Earth in view, {until(ef.h, 'sets in')}.</> : <>Earth behind terrain, {until(ef.h, 'rises in')}.</>}
        </p>

        <div className="controls">
          <div className="stepper" role="group" aria-label="Landing date">
            <button aria-label="Land one day earlier" disabled={landingDay === 0} onClick={() => selectScenario(site, landingDay - 1)}>
              ‹
            </button>
            <span>{longDate(dayMs(landingDay))}</span>
            <button
              aria-label="Slip one day later"
              disabled={landingDay === dataset.days - 1}
              onClick={() => selectScenario(site, landingDay + 1)}
            >
              ›
            </button>
          </div>
          <select aria-label="Mission length" value={missionLength} onChange={(e) => setMissionLength(+e.target.value)}>
            {dataset.missionLengths.map((n) => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav className="hero-right" aria-label="Sites">
        {dataset.sites.map((x) => {
          const kk = status(windowStats(dataset.bySite[x.id], landingDay * 24, missionLength * 24))
          const head = x.group !== group ? <div className="group-h">{x.group}</div> : null
          group = x.group
          return (
            <Fragment key={x.id}>
              {head}
              <button
                className={`site${x.id === site ? ' on' : ''}`}
                aria-pressed={x.id === site}
                title={`${x.lat.toFixed(2)}°, ${x.lon.toFixed(2)}°E. ${x.source}`}
                onClick={() => selectSite(x.id)}
              >
                <span className={`dot ${DOT[kk]}`} />
                {x.name}
              </button>
            </Fragment>
          )
        })}
      </nav>

      {webgl && (
        <button className="recentre" onClick={() => setRecentre((n) => n + 1)}>
          Centre on site
        </button>
      )}

      <div className="hero-bottom">
        <Timeline />
      </div>
    </section>
  )
}
