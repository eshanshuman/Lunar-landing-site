/**
 * The application shell. On a desktop window it is one fixed screen with no page scroll:
 * a top bar, a left column that always shows the chosen site and its verdict, a main stage
 * that swaps views in place, and the timeline docked along the bottom. On a phone the same
 * parts stack and the page scrolls.
 */
import { Component, Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { dataFor, dataset, dayMs, siteById } from '../data/dataset'
import { PRESETS } from '../data/presets'
import { fmtDur, pct } from '../lib/format'
import { isVisible, nextFlip, OK_FRACTION, status, windowStats } from '../lib/visibility'
import { useTween } from '../lib/useTween'
import IntroOverlay from '../scenes/Intro/IntroOverlay'
import { useTile } from '../scenes/Terrain/useTile'
import { useSiteData, useStore, VIEWS } from '../state/store'
import Backtest from './Backtest'
import DataNote from './DataNote'
import Explain from './Explain'
import { NightPlanner, SkyBlocked } from './NightSky'
import ScenarioDiff, { placeName } from './ScenarioDiff'
import SkyView from './SkyView'
import SlipGrid from './SlipGrid'
import SunlightMap from './SunlightMap'
import TerrainPanel from './TerrainPanel'
import Timeline from './Timeline'

const MoonScene = lazy(() => import('../scenes/Moon/MoonScene'))
const TerrainScene = lazy(() => import('../scenes/Terrain/TerrainScene'))

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
  <div className="stage-msg">
    The 3D Moon needs WebGL, which this browser is not providing.
    <br />
    Every other view still works.
  </div>
)

const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const shortDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const VERDICT = ['Poor window', '', 'Good window'] as const
const DOT = ['g0', 'g1', 'g2'] as const

/* ------------------------------------------------------------------ top bar */

function TopBar({ webgl }: { webgl: boolean }) {
  const replayIntro = useStore((s) => s.replayIntro)
  const loadPreset = useStore((s) => s.loadPreset)
  const setView = useStore((s) => s.setView)
  const aboutOpen = useStore((s) => s.aboutOpen)
  const setAboutOpen = useStore((s) => s.setAboutOpen)
  return (
    <header className="topbar">
      <span className="wordmark">Lunar Landing Site Navigator</span>
      {webgl && (
        <button
          className="top-btn"
          onClick={() => {
            setView('globe')
            replayIntro()
          }}
        >
          Replay intro
        </button>
      )}
      <span className="top-gap" />
      {PRESETS.map((p) => (
        <button key={p.id} className="top-btn" title={p.note} onClick={() => loadPreset(p.id)}>
          {p.label}
        </button>
      ))}
      <button className="top-btn" aria-expanded={aboutOpen} aria-controls="about-drawer" onClick={() => setAboutOpen(!aboutOpen)}>
        About the data
      </button>
      {dataset.source === 'sample' && (
        <span className="badge" title="You opened the sample view. The Sun and Earth tracks and the terrain skylines are synthetic stand-ins. The Moon imagery is real.">
          Sample data, not real values
        </span>
      )}
    </header>
  )
}

/* -------------------------------------------------------------- left column */

function Meter({ label, f, colour, deltaH, marginal, title }: { label: string; f: number; colour: string; deltaH: number | null; marginal: number; title: string }) {
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
      {marginal > 0 && (
        <div
          className="meter-note"
          title="Hours when the disc is partly behind the skyline: the centre is within one disc radius of the terrain, above or below. They are already counted as in view or blocked by where the centre is."
        >
          {marginal} h marginal, disc partly behind the skyline
        </div>
      )}
    </div>
  )
}

/** Always on screen: which site, how good it is, and the controls that change the scenario. */
function LeftColumn() {
  const site = useStore((s) => s.site)
  const cell = useStore((s) => s.cell)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const t = useStore((s) => s.t)
  const pinA = useStore((s) => s.pinA)
  const selectSite = useStore((s) => s.selectSite)
  const selectScenario = useStore((s) => s.selectScenario)
  const setMissionLength = useStore((s) => s.setMissionLength)
  const setHoverSite = useStore((s) => s.setHoverSite)
  const setCell = useStore((s) => s.setCell)
  const pin = useStore((s) => s.pin)
  const unpin = useStore((s) => s.unpin)

  const s = siteById(site)
  const d = useSiteData()
  const n = missionLength * 24
  const st = windowStats(d, landingDay * 24, n)
  const k = status(st)
  const i = Math.min(landingDay * 24 + t, d.sun.el.length - 1)
  const sf = nextFlip(d, i, 'sun')
  const ef = nextFlip(d, i, 'earth')
  const verdict = k === 1 ? (st.sunF < OK_FRACTION ? 'Not enough sunlight' : 'Earth link drops out') : VERDICT[k]
  const src = dataset.source === 'sample' ? 'Sample data, not a real value.' : ''
  const until = (h: number | null, soon: string) => (h === null ? 'for the rest of the data' : `${soon} ${fmtDur(h)}`)

  // Plan A is compared over the mission length selected now, like the comparison view.
  const a = pinA ? windowStats(dataFor(pinA.site, pinA.cell), pinA.landingDay * 24, n) : null
  const isA =
    !!pinA && pinA.site === site && pinA.landingDay === landingDay && pinA.cell?.col === cell?.col && pinA.cell?.row === cell?.row

  let group: string | null = null
  return (
    <aside className="left" aria-label="Site and scenario">
      <nav className="left-sites" aria-label="Sites">
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

      <div className="left-main">
        <h1 key={s.id} className="swap">
          {s.name}
        </h1>
        {cell && (
          <p className="picked swap" key={`${cell.col},${cell.row}`}>
            Map point {placeName(site, cell).replace(` of ${s.name}`, '')} of the site.{' '}
            <button className="link" onClick={() => setCell(null)}>
              Back to {s.name}
            </button>
          </p>
        )}
        <div className="verdict swap" key={verdict} aria-live="polite">
          <span className={`dot ${DOT[k]}`} />
          {verdict}
        </div>

        <Meter
          label="Sunlight"
          f={st.sunF}
          colour="var(--color-sun)"
          deltaH={a && !isA ? st.sun - a.sun : null}
          marginal={st.sunMarginal}
          title={`Share of the mission with the Sun above the terrain. A good window needs ${pct(OK_FRACTION)}%. ${src}`}
        />
        <Meter
          label="Direct link to Earth"
          f={st.earthF}
          colour="var(--color-earth)"
          deltaH={a && !isA ? st.earth - a.earth : null}
          marginal={st.earthMarginal}
          title={`Share of the mission with Earth above the terrain. A good window needs ${pct(OK_FRACTION)}%. ${src}`}
        />

        <p className="lede">
          {sf.now ? <>Sun in view, {until(sf.h, 'sets in')}.</> : <>Sun behind terrain, {until(sf.h, 'rises in')}.</>}{' '}
          {ef.now ? <>Earth in view, {until(ef.h, 'sets in')}.</> : <>Earth behind terrain, {until(ef.h, 'rises in')}.</>}
        </p>

        <div className="left-field">
          <span className="lbl">Landing</span>
          <div className="stepper" role="group" aria-label="Landing date">
            <button aria-label="Land one day earlier" disabled={landingDay === 0} onClick={() => selectScenario(site, landingDay - 1)}>
              ‹
            </button>
            <span>{longDate(dayMs(landingDay))}</span>
            <button aria-label="Slip one day later" disabled={landingDay === dataset.days - 1} onClick={() => selectScenario(site, landingDay + 1)}>
              ›
            </button>
          </div>
        </div>
        <div className="left-field">
          <span className="lbl">Stay</span>
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
                {isA ? 'This is plan A.' : `Plan A: ${placeName(pinA.site, pinA.cell)}, ${shortDate(dayMs(pinA.landingDay))}.`}
              </span>
              {!isA && (
                <button className="link" onClick={() => selectScenario(pinA.site, pinA.landingDay, pinA.cell)}>
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
    </aside>
  )
}

/* -------------------------------------------------------------------- globe */

/** The 3D Moon. It stays mounted whichever view is showing, so the intro and the camera are never lost. */
function GlobeLayer({ webgl, shown }: { webgl: boolean; shown: boolean }) {
  const intro = useStore((s) => s.intro)
  const [recentre, setRecentre] = useState(0)
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  return (
    <div className={`globe-layer${shown ? '' : ' off'}`} aria-hidden={!shown}>
      <div className={`globe-canvas${ready || intro || !webgl ? ' ready' : ''}`}>
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
      {webgl && !ready && !intro && <div className="stage-msg">Loading the Moon…</div>}
      {webgl && (
        <button className="globe-recentre link" onClick={() => setRecentre((c) => c + 1)}>
          Centre on site
        </button>
      )}
    </div>
  )
}

/**
 * Picture-in-picture: the live "Shadows on the ground" view for the selected site, in the corner
 * of the globe. Same terrain, same Sun direction and the same timeline as the full view.
 */
function ShadowPip() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const t = useStore((s) => s.t)
  const hidden = useStore((s) => s.pipHidden)
  const setHidden = useStore((s) => s.setPipHidden)
  const setView = useStore((s) => s.setView)
  const tile = useTile(site)
  if (tile === null || tile === 'error') return null // no terrain tile for this site
  if (hidden) {
    return (
      <button className="pip-show btn" onClick={() => setHidden(false)}>
        Show shadows on the ground
      </button>
    )
  }
  const d = dataset.bySite[site]
  const i = Math.min(landingDay * 24 + t, d.sun.el.length - 1)
  return (
    <section className="pip" aria-label={`Shadows on the ground at ${siteById(site).name}`}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <header className="pip-head">
        <span>Shadows on the ground</span>
        <button className="link" onClick={() => setView('terrain')}>
          Expand
        </button>
        <button className="link" onClick={() => setHidden(true)}>
          Hide
        </button>
      </header>
      <div className="pip-body">
        {tile === 'loading' ? (
          <div className="stage-msg">Loading the terrain…</div>
        ) : (
          <Suspense fallback={<div className="stage-msg">Loading the 3D view…</div>}>
            <TerrainScene
              tile={tile}
              exaggeration={1}
              fill={false}
              sky={{
                sunAz: d.sun.az[i],
                sunEl: d.sun.el[i],
                earthAz: d.earth.az[i],
                earthEl: d.earth.el[i],
                sunClear: isVisible(d, 'sun', i),
                earthClear: isVisible(d, 'earth', i),
              }}
            />
          </Suspense>
        )}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------- stage */

function ViewStrip() {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  return (
    <nav className="strip" aria-label="Views">
      {VIEWS.map(([id, label]) => (
        <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>
          {label}
        </button>
      ))}
    </nav>
  )
}

function AboutDrawer() {
  const open = useStore((s) => s.aboutOpen)
  const setOpen = useStore((s) => s.setAboutOpen)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])
  if (!open) return null
  return (
    <div className="drawer" id="about-drawer" role="dialog" aria-label="About the data">
      <button className="link drawer-close" onClick={() => setOpen(false)} autoFocus>
        Close
      </button>
      <DataNote />
      <section className="card aside mt-8">
        <h2>Keyboard</h2>
        <p className="note">Space plays or pauses. Left and right arrows step one hour. Up and down arrows change site. Escape closes this panel.</p>
      </section>
    </div>
  )
}

export default function Shell() {
  const intro = useStore((s) => s.intro)
  const revealed = useStore((s) => s.revealed)
  const view = useStore((s) => s.view)
  const finishIntro = useStore((s) => s.finishIntro)
  const webgl = useMemo(hasWebGL, [])
  // No 3D, no intro: go straight to the application.
  useEffect(() => {
    if (!webgl && useStore.getState().intro) finishIntro()
  }, [webgl, finishIntro])

  return (
    <div className={`app${revealed ? '' : ' pre'}${intro ? ' in-intro' : ''}`}>
      <TopBar webgl={webgl} />
      <LeftColumn />
      <main className="stage">
        <ViewStrip />
        <div className={`stage-body view-${view}`}>
          <GlobeLayer webgl={webgl} shown={view === 'globe'} />
          {view === 'globe' && revealed && <ShadowPip />}
          {view === 'terrain' && (
            <div className="view">
              <TerrainPanel />
            </div>
          )}
          {view === 'map' && (
            <div className="view">
              <SunlightMap />
            </div>
          )}
          {view === 'sky' && (
            <div className="view">
              <SkyView />
              <Explain />
            </div>
          )}
          {view === 'slip' && (
            <div className="view">
              <SlipGrid />
              <ScenarioDiff />
            </div>
          )}
          {view === 'backtest' && (
            <div className="view one">
              <Backtest />
            </div>
          )}
          {view === 'night' && (
            <div className="view">
              <NightPlanner />
              <SkyBlocked />
            </div>
          )}
        </div>
      </main>
      <footer className="bottombar">
        <Timeline />
      </footer>
      <AboutDrawer />
      <div className="intro-layer">
        <IntroOverlay />
      </div>
    </div>
  )
}
