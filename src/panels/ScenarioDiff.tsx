import { dataset, dayMs, siteById } from '../data/dataset'
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

export default function ScenarioDiff() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const pinA = useStore((s) => s.pinA)
  const pin = useStore((s) => s.pin)
  const unpin = useStore((s) => s.unpin)

  let body
  if (!pinA) {
    body = (
      <p className="note">
        Pin the current choice as plan A, then click any other cell in the slip grid to see exactly what changes.
      </p>
    )
  } else {
    // Both plans are compared over the mission length currently selected.
    const n = missionLength * 24
    const a = windowStats(dataset.bySite[pinA.site], pinA.landingDay * 24, n)
    const b = windowStats(dataset.bySite[site], landingDay * 24, n)
    const dd = landingDay - pinA.landingDay
    const what = site === pinA.site ? `slip ${dd >= 0 ? '+' : ''}${dd} d` : `${siteById(site).name}, ${fmtDate(dayMs(landingDay))}`
    body = (
      <>
        <div className="lbl -mt-1 mb-1.5">
          A: {siteById(pinA.site).name}, {fmtDate(dayMs(pinA.landingDay))} → B: {what}
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
    <section className="card">
      <h2>Scenario diff</h2>
      <div aria-live="polite">{body}</div>
      <div className="mt-2.5 flex gap-2">
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
