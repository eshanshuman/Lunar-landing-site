import { useEffect, useState } from 'react'
import { C, FONT } from '../lib/theme'
import { fmtDT } from '../lib/format'
import { useCanvas } from './useCanvas'
import { useStore } from '../state/store'

/** One entry of public/data/backtest.json, written by pipeline/backtest.py. */
type Mission = {
  mission: string
  site_id: string
  landed_utc: string
  ops_ended_utc: string
  ops_ended_label: string
  ops_ended_day_only: boolean
  context: string
  sources: string[]
  predicted_sunset_utc: string | null
  sun_first_limb_behind_utc: string | null
  sun_fully_behind_utc: string | null
  flat_horizon_sunset_utc: string | null
  sun_el_at_landing_deg: number
  earth_visible_after_landing_pct: number
  series: { start_utc: string; step_h: number; sun_el: number[]; skyline_at_sun: number[] }
  meta: { ephemeris: string; terrain: string; sunset_definition: string }
}

const ms = (s: string | null) => (s ? Date.parse(s) : NaN)
const H = 36e5

/** Hours from when operations ended to terrain sunset. A day-only end date gives a range. */
function gapHours(m: Mission): [number, number] {
  const sunset = ms(m.predicted_sunset_utc)
  const end = ms(m.ops_ended_utc)
  return m.ops_ended_day_only ? [(sunset - end - 24 * H) / H, (sunset - end) / H] : [(sunset - end) / H, (sunset - end) / H]
}

function fmtGap([a, b]: [number, number]) {
  const one = (h: number) => (Math.abs(h) >= 36 ? `${(h / 24).toFixed(1)} days` : `${Math.round(h)} hours`)
  if (Math.abs(b - a) < 1) return one(a)
  return Math.abs(a) >= 36 ? `${(a / 24).toFixed(1)}–${(b / 24).toFixed(1)} days` : `${Math.round(a)}–${Math.round(b)} hours`
}

function verdict(m: Mission) {
  const [lo, hi] = gapHours(m)
  const name = m.mission.split(' ').slice(-1)[0]
  if (lo > 24)
    return {
      head: `${name} stopped ${fmtGap([lo, hi])} before the Sun went behind the terrain.`,
      body: 'Sunlight did not end this mission. The Sun was still above the ridges when it went quiet, so the limit was power, not geometry.',
    }
  if (hi >= 0)
    return {
      head: `${name} stopped ${fmtGap([lo, hi])} before our predicted terrain sunset.`,
      body: 'That fits a lander being put to sleep just before dark. The prediction and the real decision line up.',
    }
  return {
    head: `${name} kept working ${fmtGap([-hi, -lo])} after our predicted terrain sunset.`,
    body: 'The prediction says it was already in shadow. Check the site coordinates and the skyline.',
  }
}

function Chart({ m, zoom }: { m: Mission; zoom: boolean }) {
  const ref = useCanvas(300, (g, w, h) => {
    const s = m.series
    const t0 = Date.parse(s.start_utc)
    const landed = ms(m.landed_utc)
    const flat = ms(m.flat_horizon_sunset_utc)
    const sunset = ms(m.predicted_sunset_utc)
    const end = ms(m.ops_ended_utc)
    const last = Number.isFinite(flat) ? flat : sunset
    const x0 = zoom ? Math.min(end, sunset) - 30 * H : landed - 12 * H
    const x1 = last + (zoom ? 8 : 18) * H
    const idx = (t: number) => (t - t0) / (s.step_h * H)
    const i0 = Math.max(0, Math.floor(idx(x0)))
    const i1 = Math.min(s.sun_el.length - 1, Math.ceil(idx(x1)))
    let yMax = 1
    for (let i = i0; i <= i1; i++) yMax = Math.max(yMax, s.sun_el[i], s.skyline_at_sun[i])
    yMax = Math.ceil(yMax + 1)
    const yMin = -2
    const L = 34, R = 12, T = 64, B = 26
    const X = (t: number) => L + ((t - x0) / (x1 - x0)) * (w - L - R)
    const Y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (h - T - B)
    const tAt = (i: number) => t0 + i * s.step_h * H

    g.font = `12px ${FONT}`
    g.textBaseline = 'middle'
    // y grid
    for (let v = 0; v <= yMax; v += yMax > 8 ? 4 : 2) {
      g.strokeStyle = C.line
      g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(w - R, Y(v)); g.stroke()
      g.fillStyle = C.dim; g.textAlign = 'right'; g.fillText(`${v}°`, L - 6, Y(v))
    }
    // x ticks: each UTC day
    g.textAlign = 'center'; g.textBaseline = 'top'
    const d0 = new Date(x0); d0.setUTCHours(0, 0, 0, 0)
    const span = (x1 - x0) / 864e5
    const stepT = span < 3 ? 6 * H : 864e5
    for (let d = d0.getTime() + stepT; d < x1; d += stepT) {
      if (d < x0) continue
      const day = new Date(d)
      if (span > 12 && day.getUTCDate() % 2) continue
      g.fillStyle = C.dim
      const lbl = day.getUTCHours()
        ? `${String(day.getUTCHours()).padStart(2, '0')}:00`
        : day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
      g.fillText(lbl, X(d), h - B + 8)
    }
    g.save()
    g.beginPath(); g.rect(L, 0, w - L - R, h); g.clip()

    // operations ended: a band for a day-only date, a line otherwise
    g.fillStyle = 'rgba(255,255,255,0.06)'
    if (m.ops_ended_day_only) g.fillRect(X(end), T, X(end + 24 * H) - X(end), h - T - B)
    g.strokeStyle = C.muted; g.setLineDash([]); g.lineWidth = 1
    if (!m.ops_ended_day_only) { g.beginPath(); g.moveTo(X(end), T); g.lineTo(X(end), h - B); g.stroke() }

    // terrain skyline under the Sun (rock)
    g.beginPath(); g.moveTo(X(tAt(i0)), Y(yMin))
    for (let i = i0; i <= i1; i++) g.lineTo(X(tAt(i)), Y(s.skyline_at_sun[i]))
    g.lineTo(X(tAt(i1)), Y(yMin)); g.closePath()
    g.fillStyle = 'rgba(106,103,97,0.55)'; g.fill()

    // flat horizon 0°
    g.setLineDash([4, 4]); g.strokeStyle = C.dim
    g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(w - R, Y(0)); g.stroke(); g.setLineDash([])

    // Sun elevation: sun colour while clear of the skyline, red once behind it
    g.lineWidth = 2
    for (let i = i0; i < i1; i++) {
      const clear = s.sun_el[i] > s.skyline_at_sun[i] && s.sun_el[i + 1] > s.skyline_at_sun[i + 1]
      g.strokeStyle = clear ? C.sun : C.bad
      g.beginPath(); g.moveTo(X(tAt(i)), Y(s.sun_el[i])); g.lineTo(X(tAt(i + 1)), Y(s.sun_el[i + 1])); g.stroke()
    }
    g.lineWidth = 1

    // event markers; labels go on the first of three rows above the plot where they fit
    const marks = [
      { t: landed, label: 'Landed', color: C.muted },
      { t: m.ops_ended_day_only ? end + 12 * H : end, label: 'Went quiet', color: C.text },
      { t: sunset, label: 'Terrain sunset', color: C.sun },
      { t: flat, label: 'Flat-horizon sunset', color: C.dim },
    ]
      .filter((k) => Number.isFinite(k.t) && k.t >= x0 && k.t <= x1)
      .sort((a, b) => a.t - b.t)
    for (const k of marks) {
      const x = X(k.t)
      g.strokeStyle = k.color; g.setLineDash([2, 3])
      g.beginPath(); g.moveTo(x, T - 6); g.lineTo(x, h - B); g.stroke(); g.setLineDash([])
    }
    g.restore()
    g.textBaseline = 'middle'
    const rowsEnd = [-Infinity, -Infinity, -Infinity]
    for (const k of marks) {
      const x = X(k.t)
      const tw = g.measureText(k.label).width
      const left = Math.min(Math.max(x - tw / 2, 2), w - 2 - tw)
      let row = rowsEnd.findIndex((e) => left > e + 10)
      if (row < 0) row = 2
      rowsEnd[row] = left + tw
      g.fillStyle = k.color; g.textAlign = 'left'
      g.fillText(k.label, left, 10 + row * 18)
    }
  })
  return (
    <canvas
      ref={ref}
      style={{ height: 300 }}
      role="img"
      aria-label={`${m.mission}: Sun elevation against the terrain skyline from landing to sunset`}
    />
  )
}

export default function Backtest() {
  const [data, setData] = useState<Mission[] | null>(null)
  const [failed, setFailed] = useState(false)
  const pick = useStore((s) => s.backtestPick)
  const setPick = useStore((s) => s.setBacktestPick)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/backtest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setFailed(true))
  }, [])

  if (failed)
    return (
      <section className="card">
        <h2>Backtest on real landings</h2>
        <p className="note mt-3">The backtest data did not load. Run <code>python pipeline/backtest.py</code>.</p>
      </section>
    )
  if (!data) return <section className="card" aria-busy="true"><h2>Backtest on real landings</h2></section>

  const m = data[pick]
  const v = verdict(m)
  return (
    <section className="card" id="backtest">
      <h2>
        Backtest on real landings
        <span className="sub">Our tool, run on missions that already happened. Real JPL and LOLA data, not sample data.</span>
      </h2>
      <div className="seg mt-3" role="group" aria-label="Mission">
        {data.map((d, i) => (
          <button key={d.site_id} aria-pressed={i === pick} onClick={() => setPick(i)}>
            {d.mission}
          </button>
        ))}
      </div>
      <p className="mt-4 text-lg">{v.head}</p>
      <p className="note mt-1">{v.body} {m.context}</p>
      <div className="seg mt-4" role="group" aria-label="Chart range">
        <button aria-pressed={!zoom} onClick={() => setZoom(false)}>Whole mission</button>
        <button aria-pressed={zoom} onClick={() => setZoom(true)}>Around sunset</button>
      </div>
      <div className="mt-3">
        <Chart m={m} zoom={zoom} />
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--color-sun)' }} />Sun height, clear of the terrain</span>
        <span><i style={{ background: 'var(--color-bad)' }} />Sun behind the terrain</span>
        <span><i style={{ background: 'var(--color-rock)' }} />Skyline in the Sun's direction</span>
        <span><i style={{ background: 'var(--color-dim)' }} />Flat horizon (0°)</span>
      </div>
      <div className="mt-4">
        <div className="diff-row"><span>Landed</span><span className="lbl">{fmtDT(ms(m.landed_utc))}</span><span /></div>
        <div className="diff-row"><span>Went quiet</span><span className="lbl">{m.ops_ended_label}</span><span /></div>
        <div className="diff-row"><span>Terrain sunset (our prediction)</span><span className="lbl">{m.predicted_sunset_utc ? fmtDT(ms(m.predicted_sunset_utc)) : 'not in window'}</span><span /></div>
        <div className="diff-row"><span>Sunset if the ground were flat</span><span className="lbl">{m.flat_horizon_sunset_utc ? fmtDT(ms(m.flat_horizon_sunset_utc)) : 'not in window'}</span><span /></div>
        <div className="diff-row"><span>Earth in view after landing</span><span className="lbl">{m.earth_visible_after_landing_pct}% of hours</span><span /></div>
      </div>
      <details className="sources">
        <summary>Method and sources</summary>
        <ul>
          <li>{m.meta.ephemeris}.</li>
          <li>{m.meta.terrain}.</li>
          <li>Terrain sunset = {m.meta.sunset_definition.toLowerCase()}; hourly data, interpolated between hours.</li>
          {m.sources.map((s) => <li key={s}>{s}</li>)}
          <li>Site coordinates are approximate; a few hundred metres can move sunset by hours.</li>
        </ul>
      </details>
    </section>
  )
}
