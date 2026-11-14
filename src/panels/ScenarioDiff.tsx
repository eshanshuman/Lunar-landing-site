import { dataFor, dayMs, gridFor, siteById } from '../data/dataset'
import { describeMove } from '../lib/grid'
import type { Cell } from '../types'
import { fmtDate, fmtDur } from '../lib/format'
import { windowStats } from '../lib/visibility'
import { useStore } from '../state/store'

function Row({ k, a, b, higherIsBetter }: { k: string; a: number; b: number; higherIsBetter: boolean }) {
  const delta = b - a
  const cls = delta === 0 ? 'flat' : delta > 0 === higherIsBetter ? 'up' : 'down'
  return (
    <div className="diff-row">
      <span>{k}</span>
      <span className="lbl">
        {a} h → {b} h
      </span>
      <span className={`d ${cls}`}>
        {delta > 0 ? '+' : ''}
        {delta} h
      </span>
    </div>
  )
}

/** First sunset is "none" when the Sun stays up for the whole mission, so it needs its own wording. */
function FirstSunsetRow({ a, b }: { a: number | null; b: number | null }) {
  const show = (h: number | null) => (h === null ? 'none' : h === 0 ? 'at landing' : fmtDur(h))
  let cls = 'flat'
  let delta = '0 h'
  if (a === null && b !== null) [cls, delta] = ['down', 'now sets']
  else if (a !== null && b === null) [cls, delta] = ['up', 'no sunset']
  else if (a !== null && b !== null && a !== b) [cls, delta] = [b > a ? 'up' : 'down', `${b > a ? '+' : ''}${b - a} h`]
  return (
    <div className="diff-row">
      <span>First sunset</span>
      <span className="lbl">
        {show(a)} → {show(b)}
      </span>
      <span className={`d ${cls}`}>{delta}</span>
    </div>
  )
}

/** "Connecting ridge" or "1.5 km NE of Connecting ridge" for a picked map point. */
export function placeName(site: string, cell: Cell | null) {
  const g = cell ? gridFor(site) : null
  if (!cell || !g) return siteById(site).name
  const m = describeMove(g, cell)
  return `${m.km.toFixed(1)} km ${m.dir} of ${siteById(site).name}`
}

export default function ScenarioDiff() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const pinA = useStore((s) => s.pinA)
  const cell = useStore((s) => s.cell)
  const pin = useStore((s) => s.pin)
  const unpin = useStore((s) => s.unpin)

  let body
  if (!pinA) {
    body = (
      <p className="note">
        Pin the current choice as plan A, then pick any other square to see exactly what changes.
      </p>
    )
  } else {
    // Both plans are compared over the mission length currently selected.
    const n = missionLength * 24
    const a = windowStats(dataFor(pinA.site, pinA.cell), pinA.landingDay * 24, n)
    const b = windowStats(dataFor(site, cell), landingDay * 24, n)
    const samePlace = site === pinA.site && cell?.col === pinA.cell?.col && cell?.row === pinA.cell?.row
    const dd = landingDay - pinA.landingDay
    const what = samePlace ? `slip ${dd >= 0 ? '+' : ''}${dd} d` : `${placeName(site, cell)}, ${fmtDate(dayMs(landingDay))}`
    body = (
      <>
        <div className="lbl -mt-1 mb-1.5">
          A: {placeName(pinA.site, pinA.cell)}, {fmtDate(dayMs(pinA.landingDay))} → B: {what}
        </div>
        <Row k="Sunlight" a={a.sun} b={b.sun} higherIsBetter />
        <Row k="Earth contact" a={a.earth} b={b.earth} higherIsBetter />
        <Row k="Longest dark" a={a.maxDark} b={b.maxDark} higherIsBetter={false} />
        <Row k="Longest Earth gap" a={a.maxGap} b={b.maxGap} higherIsBetter={false} />
        <FirstSunsetRow a={a.firstSet} b={b.firstSet} />
      </>
    )
  }

  return (
    <section className="card aside">
      <h2>Compare two plans</h2>
      <div aria-live="polite">{body}</div>
      <div className="mt-4 flex gap-2">
        {pinA ? (
          <>
            <button className="btn" onClick={pin}>Re-pin here</button>
            <button className="btn" onClick={unpin}>Clear plan A</button>
          </>
        ) : (
          <button className="btn" onClick={pin}>Pin as plan A</button>
        )}
      </div>
    </section>
  )
}
