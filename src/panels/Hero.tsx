import { Component, Fragment, lazy, Suspense, useCallback, useMemo, useState, type ReactNode } from 'react'
import { dataset, dayMs, siteById } from '../data/dataset'
import { fmtDur, pct } from '../lib/format'
import { useTween } from '../lib/useTween'
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
const shortDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const VERDICT = ['Poor window', '', 'Good window'] as const
const DOT = ['g0', 'g1', 'g2'] as const

function Meter({ label, f, colour, deltaH, title }: { label: string; f: number; colour: string; deltaH: number | null; title: string }) {
  const shown = useTween(f * 100)
  return (
    <div className="meter" title={title}>
      <div className="meter-head">
        <span>
          {label}
          {deltaH !== null && (
            <span className={`delta ${deltaH === 0 ? 'flat' : deltaH > 0 ? 'up' : 'down'}`}>
              {deltaH > 0 ? '+' : ''}
              {deltaH} h vs plan A
            </span>
          )}
        </span>
        <b>{Math.round(shown)}%</b>
      </div>
      <div className="meter-bar">
        <i style={{ width: `${f * 100}%`, background: colour }} />
      </div>
    </div>
  )
}

/** First screen: the 3D Moon with one plain-language verdict for the chosen site and date. */
export default function Hero() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const t = useStore((s) => s.t)
  const pinA = useStore((s) => s.pinA)
  const selectSite = useStore((s) => s.selectSite)
  const selectScenario = useStore((s) => s.selectScenario)
  const setMissionLength = useStore((s) => s.setMissionLength)
  const setHoverSite = useStore((s) => s.setHoverSite)
  const pin = useStore((s) => s.pin)
  const unpin = useStore((s) => s.unpin)
  const [recentre, setRecentre] = useState(0)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  const webgl = useMemo(hasWebGL, [])

  const s = siteById(site)
  const d = dataset.bySite[site]
  const n = missionLength * 24
  const st = windowStats(d, landingDay * 24, n)
  const k = status(st)
  const i = Math.min(landingDay * 24 + t, d.sun.el.length - 1)
  const sf = nextFlip(d, i, 'sun')
  const ef = nextFlip(d, i, 'earth')
  const verdict = k === 1 ? (st.sunF < OK_FRACTION ? 'Not enough sunlight' : 'Earth link drops out') : VERDICT[k]
  const src = dataset.source === 'sample' ? 'Sample data, not a real value.' : ''
  const until = (h: number | null, soon: string) => (h === null ? 'for the rest of the data' : `${soon} ${fmtDur(h)}`)

  // Plan A is compared over the mission length selected now, like the comparison panel below.
  const a = pinA ? windowStats(dataset.bySite[pinA.site], pinA.landingDay * 24, n) : null
  const isA = !!pinA && pinA.site === site && pinA.landingDay === landingDay

  let group: string | null = null
  return (
    <section className="hero">
      <div className={`hero-canvas${ready || !webgl ? ' ready' : ''}`}>
        {webgl ? (
          <Boundary fallback={<NoWebGL />}>
            <Suspense fallback={null}>
              <MoonScene recentre={recentre} onReady={onReady} />
            </Suspense>
          </Boundary>
        ) : (
          <NoWebGL />
        )}
      </div>
      {webgl && !ready && <div className="hero-msg loading">Loading the Moon…</div>}

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
        <h1 key={s.id} className="swap">
          {s.name}
        </h1>
        <div className="verdict swap" key={verdict} aria-live="polite">
          <span className={`dot ${DOT[k]}`} />
          {verdict}
        </div>
        <p className="lede">
          Land on <b>{longDate(dayMs(landingDay))}</b> and stay <b>{missionLength} days</b>.
        </p>

        <Meter
          label="Sunlight"
          f={st.sunF}
          colour="var(--color-sun)"
          deltaH={a && !isA ? st.sun - a.sun : null}
          title={`Share of the mission with the Sun above the terrain. A good window needs ${pct(OK_FRACTION)}%. ${src}`}
        />
        <Meter
          label="Direct link to Earth"
          f={st.earthF}
          colour="var(--color-earth)"
          deltaH={a && !isA ? st.earth - a.earth : null}
          title={`Share of the mission with Earth above the terrain. A good window needs ${pct(OK_FRACTION)}%. ${src}`}
        />

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
            {dataset.missionLengths.map((len) => (
              <option key={len} value={len}>
                {len} days
              </option>
            ))}
          </select>
        </div>
        <div className="controls plan">
          {!pinA ? (
            <button className="btn" onClick={pin}>
              Pin as plan A
            </button>
          ) : (
            <>
              <span className="lbl">
                {isA ? 'This is plan A.' : `Plan A: ${siteById(pinA.site).name}, ${shortDate(dayMs(pinA.landingDay))}.`}
              </span>
              {!isA && (
                <button className="link" onClick={() => selectScenario(pinA.site, pinA.landingDay)}>
                  Back to plan A
                </button>
              )}
              <button className="link" onClick={unpin}>
                Clear plan A
              </button>
            </>
          )}
        </div>
      </div>

      <nav className="hero-right" aria-label="Sites">
        {dataset.sites.map((x) => {
          const kk = status(windowStats(dataset.bySite[x.id], landingDay * 24, n))
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
                onPointerEnter={() => setHoverSite(x.id)}
                onPointerLeave={() => setHoverSite(null)}
                onFocus={() => setHoverSite(x.id)}
                onBlur={() => setHoverSite(null)}
              >
                <span className={`dot ${DOT[kk]}`} />
                {x.name}
              </button>
            </Fragment>
          )
        })}
      </nav>

      <div className="hero-links">
        {webgl && <button onClick={() => setRecentre((c) => c + 1)}>Centre on site</button>}
        <a href="#slip">Compare landing dates</a>
      </div>

      <div className="hero-bottom">
        <Timeline />
      </div>
    </section>
  )
}
