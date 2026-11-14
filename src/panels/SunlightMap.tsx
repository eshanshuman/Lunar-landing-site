import { useMemo, useState } from 'react'
import { dataset, gridFor, gridSource, gridStatus, siteById } from '../data/dataset'
import { fmtDur, pct } from '../lib/format'
import { bit, centreCell, describeMove, nearestBetter, pointIndex, visibleHours } from '../lib/grid'
import { C, FONT } from '../lib/theme'
import { OK_FRACTION, windowStats, type Body } from '../lib/visibility'
import { useStore } from '../state/store'
import type { Cell, GridData } from '../types'
import Tooltip, { type TipState } from './Tooltip'
import { useCanvas } from './useCanvas'

const SIZE = 520
const BODY: Record<Body, { rgb: string; word: string; gain: string }> = {
  sun: { rgb: '239,181,79', word: 'sunlight', gain: 'sunlight' },
  earth: { rgb: '130,180,232', word: 'Earth in view', gain: 'Earth link' },
}

/** Hillshade of the grid's heights, lit from the north-west: 0 (dark) to 1 (bright) per point. */
function hillshade(g: GridData): Float32Array {
  const n = g.size
  const out = new Float32Array(n * n).fill(0.5)
  const h = g.height_m
  if (!h) return out
  const at = (c: number, r: number) => h[Math.max(0, Math.min(n - 1, r)) * n + Math.max(0, Math.min(n - 1, c))]
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const dzdE = (at(c + 1, r) - at(c - 1, r)) / (2 * g.spacing_m)
      const dzdN = (at(c, r - 1) - at(c, r + 1)) / (2 * g.spacing_m)
      // Slope facing the light (from the NW, 45° up) is bright. Relief exaggerated 3x so it reads.
      const k = 3
      const nx = -dzdE * k, ny = -dzdN * k, nz = 1
      const len = Math.hypot(nx, ny, nz)
      const v = (nx * -0.5 + ny * 0.5 + nz * 0.707) / len
      out[r * n + c] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5 // a hole in the DEM stays mid-grey
    }
  return out
}

/** The 20 km around a site as a grid of points: who has the Sun (or Earth), now or over the mission. */
export default function SunlightMap() {
  const site = useStore((s) => s.site)
  const cell = useStore((s) => s.cell)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const t = useStore((s) => s.t)
  const setCell = useStore((s) => s.setCell)
  const [mode, setMode] = useState<'now' | 'mission'>('mission')
  const [body, setBody] = useState<Body>('sun')
  const [tip, setTip] = useState<TipState | null>(null)

  const gridTick = useStore((s) => s.gridTick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(() => gridFor(site), [site, gridTick])
  const shade = useMemo(() => (g ? hillshade(g) : null), [g])
  const n = missionLength * 24
  const s0 = landingDay * 24
  const hours = useMemo(() => (g ? visibleHours(g, body, s0, n) : null), [g, body, s0, n])
  const ref: Cell | null = g ? (cell ?? centreCell(g)) : null
  const better = useMemo(
    () => (g && hours && ref ? nearestBetter(g, hours, ref, Math.ceil(OK_FRACTION * n)) : null),
    // ref is derived from cell and g
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g, hours, cell, n],
  )
  const B = BODY[body]
  const name = siteById(site).name

  const canvasRef = useCanvas(SIZE, (ctx, w, h) => {
    if (!g || !shade || !hours || !ref) return
    const side = Math.min(w, h)
    const ox = (w - side) / 2
    const cs = side / g.size
    const hourNow = Math.min(s0 + t, g.hours - 1)
    const X = (c: number) => ox + c * cs
    const Y = (r: number) => r * cs
    const mid = (c: Cell): [number, number] => [X(c.col) + cs / 2, Y(c.row) + cs / 2]

    for (let r = 0; r < g.size; r++)
      for (let c = 0; c < g.size; c++) {
        const p = r * g.size + c
        const v = Math.round(22 + shade[p] * 70)
        ctx.fillStyle = `rgb(${v},${v - 1},${v - 3})`
        ctx.fillRect(X(c), Y(r), cs + 0.5, cs + 0.5)
        if (mode === 'now') {
          ctx.fillStyle = bit(g, body, p, hourNow) ? `rgba(${B.rgb},0.6)` : 'rgba(0,0,0,0.58)'
        } else {
          const f = hours[p] / n
          // One hue: the more hours in view, the more colour; little or none stays dark.
          ctx.fillStyle = f > 0.5 ? `rgba(${B.rgb},${(0.12 + (f - 0.5) * 1.4).toFixed(3)})` : `rgba(0,0,0,${(0.6 - f * 0.9).toFixed(3)})`
        }
        ctx.fillRect(X(c), Y(r), cs + 0.5, cs + 0.5)
      }

    // Named site at the centre
    const [sx, sy] = mid(centreCell(g))
    ctx.strokeStyle = C.text
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(sx, sy, cs * 0.75, 0, 7)
    ctx.stroke()
    ctx.fillStyle = C.text
    ctx.beginPath()
    ctx.arc(sx, sy, 2.2, 0, 7)
    ctx.fill()

    // A picked point
    if (cell) {
      ctx.strokeStyle = C.text
      ctx.lineWidth = 2
      ctx.strokeRect(X(cell.col) + 1, Y(cell.row) + 1, cs - 2, cs - 2)
    }

    // The nearest better point: ring, arrow from where we are, and the move in words
    if (better) {
      const [ax, ay] = mid(ref)
      const [bx, by] = mid(better)
      const ang = Math.atan2(by - ay, bx - ax)
      const ringR = cs * 0.95
      const startGap = cell ? cs * 0.75 : cs * 0.95
      const len = Math.hypot(bx - ax, by - ay)
      ctx.strokeStyle = C.ok
      ctx.fillStyle = C.ok
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(bx, by, ringR, 0, 7)
      ctx.stroke()
      if (len > startGap + ringR + 6) {
        const x0 = ax + Math.cos(ang) * startGap
        const y0 = ay + Math.sin(ang) * startGap
        const x1 = bx - Math.cos(ang) * (ringR + 2)
        const y1 = by - Math.sin(ang) * (ringR + 2)
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x1 - Math.cos(ang - 0.45) * 9, y1 - Math.sin(ang - 0.45) * 9)
        ctx.lineTo(x1 - Math.cos(ang + 0.45) * 9, y1 - Math.sin(ang + 0.45) * 9)
        ctx.closePath()
        ctx.fill()
      } else {
        // Next-door square: no room for a shaft, so just the arrowhead on the ring.
        const x1 = bx - Math.cos(ang) * ringR
        const y1 = by - Math.sin(ang) * ringR
        ctx.beginPath()
        ctx.moveTo(x1 + Math.cos(ang) * 5, y1 + Math.sin(ang) * 5)
        ctx.lineTo(x1 - Math.cos(ang - 0.6) * 7, y1 - Math.sin(ang - 0.6) * 7)
        ctx.lineTo(x1 - Math.cos(ang + 0.6) * 7, y1 - Math.sin(ang + 0.6) * 7)
        ctx.closePath()
        ctx.fill()
      }
      const text = `Move ${better.km.toFixed(1)} km ${better.dir} → +${better.gain_h} h ${B.gain}`
      ctx.font = `500 13px ${FONT}`
      const tw = ctx.measureText(text).width
      const lx = Math.max(ox + 6, Math.min(ox + side - tw - 16, bx - tw / 2 - 5))
      const ly = by > 44 ? by - ringR - 28 : by + ringR + 8
      ctx.fillStyle = 'rgba(9,9,10,0.86)'
      ctx.beginPath()
      ctx.roundRect(lx, ly, tw + 12, 22, 5)
      ctx.fill()
      ctx.fillStyle = C.ok
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, lx + 6, ly + 11.5)
    }

    // North and a scale bar
    ctx.fillStyle = C.text
    ctx.font = `500 12px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('N', ox + side - 16, 8)
    ctx.beginPath()
    ctx.moveTo(ox + side - 16, 24)
    ctx.lineTo(ox + side - 20, 32)
    ctx.lineTo(ox + side - 12, 32)
    ctx.closePath()
    ctx.fill()
    const km5 = (5000 / g.spacing_m) * cs
    ctx.fillRect(ox + 10, side - 14, km5, 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText('5 km', ox + 10, side - 18)
  })

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): Cell | null => {
    if (!g) return null
    const r = e.currentTarget.getBoundingClientRect()
    const side = Math.min(r.width, r.height)
    const ox = (r.width - side) / 2
    const col = Math.floor(((e.clientX - r.left - ox) / side) * g.size)
    const row = Math.floor(((e.clientY - r.top) / side) * g.size)
    return col >= 0 && row >= 0 && col < g.size && row < g.size ? { col, row } : null
  }

  const heading = (
    <h2>
      Sunlight map
      {dataset.source === 'sample' || gridSource === 'sample' ? (
        <span className="tag-sample">Sample data</span>
      ) : (
        <span className="tag-real">Real LOLA terrain, 80 m</span>
      )}
      <span className="sub">
        The 20 km around {name}, one square every 500 m. A short move can change how much {B.word} a lander gets.
        Pick a square to try that point.
      </span>
    </h2>
  )

  if (!g || !hours || !ref) {
    return (
      <>
        <section className="card" id="map">
          {heading}
          <p className="note">
            {gridStatus(site) === 'loading'
              ? 'Loading the map…'
              : gridStatus(site) === 'error'
                ? 'The map for this site could not be loaded. Reload the page to try again.'
                : `There is no map around ${name}. Maps cover the Artemis study regions; pick one of those sites to see it.`}
          </p>
        </section>
        <div />
      </>
    )
  }

  const refHours = hours[pointIndex(g, ref)]
  // The verdict at the top of the page uses the site's 20 m skyline; this map uses 80 m terrain for every square.
  const siteStats = windowStats(dataset.bySite[site], s0, n)
  const siteHours = body === 'sun' ? siteStats.sun : siteStats.earth
  const centreHours = hours[pointIndex(g, centreCell(g))]
  const agree = g.meta.centre_agreement?.[body]
  return (
    <>
      <section className="card" id="map">
        {heading}
        <canvas
          ref={canvasRef}
          style={{ height: SIZE, cursor: 'crosshair', touchAction: 'pan-y' }}
          role="img"
          aria-label={`Map of ${B.word} around ${name}. ${
            better ? `Nearest better point: ${better.km.toFixed(1)} km ${better.dir}, plus ${better.gain_h} hours.` : 'No better point nearby.'
          }`}
          onClick={(e) => {
            const c = cellAt(e)
            if (c) setCell(c)
          }}
          onPointerMove={(e) => {
            const c = e.pointerType === 'mouse' ? cellAt(e) : null
            if (!c) return setTip(null)
            const p = pointIndex(g, c)
            const m = describeMove(g, c)
            const now = bit(g, body, p, Math.min(s0 + t, g.hours - 1))
            setTip({
              x: e.clientX,
              y: e.clientY,
              content: (
                <>
                  <b>{m.km === 0 ? name : `${m.km.toFixed(1)} km ${m.dir} of ${name}`}</b>
                  <br />
                  {hours[p]} h of {n} h with {B.word} ({pct(hours[p] / n)}%)
                  <br />
                  Right now: {now ? 'in view' : 'blocked by terrain'}
                </>
              ),
            })
          }}
          onPointerLeave={() => setTip(null)}
        />
        <Tooltip tip={tip} />
      </section>

      <section className="card aside">
        <h2>Show</h2>
        <div className="seg" role="group" aria-label="What the map shows">
          <button aria-pressed={mode === 'mission'} onClick={() => setMode('mission')}>
            Whole mission
          </button>
          <button aria-pressed={mode === 'now'} onClick={() => setMode('now')}>
            Right now
          </button>
        </div>
        <div className="seg mt-2" role="group" aria-label="Sun or Earth">
          <button aria-pressed={body === 'sun'} onClick={() => setBody('sun')}>
            Sun
          </button>
          <button aria-pressed={body === 'earth'} onClick={() => setBody('earth')}>
            Earth
          </button>
        </div>

        <div className="legend mt-4">
          {mode === 'now' ? (
            <>
              <span><i className="chip" style={{ background: `rgb(${B.rgb})` }} />{body === 'sun' ? 'In sunlight' : 'Earth in view'}</span>
              <span><i className="chip" style={{ background: '#1d1c1b' }} />Blocked by terrain</span>
            </>
          ) : (
            <span className="w-full">
              <i className="ramp" style={{ background: `linear-gradient(90deg, #111 0%, #3a3936 50%, rgb(${B.rgb}) 100%)` }} />
              <span className="flex justify-between"><span>0%</span><span>share of the {missionLength}-day mission</span><span>100%</span></span>
            </span>
          )}
        </div>
        <p className="note mt-3">
          {mode === 'now' ? 'Follows the timeline: press play above to watch the shadows move.' : `From landing day, ${n} hours.`}
        </p>

        {gridSource === 'pipeline' && (
          <p className="note mt-3">
            <b>Coarser than the verdict.</b> Every square here is worked out from 80 m terrain; the verdict at the top of
            the page uses 20 m terrain for the site itself. For this mission the map gives {name} {centreHours} h of{' '}
            {B.word} and the 20 m skyline gives {siteHours} h.
            {agree !== undefined && agree !== null && (
              <>
                {' '}
                Over the whole data window the two agree in {pct(agree)}% of hours at this site.
                {agree < 0.99 && ' Small gains suggested here are within that margin, so treat them with caution.'}
              </>
            )}
          </p>
        )}

        <h2 className="mt-7">Nearest better point</h2>
        <p className="note" aria-live="polite">
          {cell ? `From the point you picked` : `At ${name}, on this map`}: <b>{refHours} h</b> of {n} h with {B.word} ({pct(refHours / n)}%).
        </p>
        {better ? (
          <>
            <p className="move">
              Move {better.km.toFixed(1)} km {better.dir} → +{better.gain_h} h {B.gain}
            </p>
            <p className="note">
              That is {fmtDur(better.gain_h)} more over the mission, {hours[pointIndex(g, better)]} h in all. It is the
              closest square that {refHours < Math.ceil(OK_FRACTION * n) && hours[pointIndex(g, better)] >= Math.ceil(OK_FRACTION * n)
                ? `reaches ${pct(OK_FRACTION)}%`
                : 'gains at least 12 hours'}.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn" onClick={() => setCell({ col: better.col, row: better.row })}>
                Try that point
              </button>
              {cell && (
                <button className="btn" onClick={() => setCell(null)}>
                  Back to {name}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="note">No square within 10 km gains 12 hours or more. This is already about as good as it gets nearby.</p>
            {cell && (
              <button className="btn mt-3" onClick={() => setCell(null)}>
                Back to {name}
              </button>
            )}
          </>
        )}
      </section>
    </>
  )
}
