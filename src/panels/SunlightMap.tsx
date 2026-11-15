import { useMemo, useState } from 'react'
import { dataset, gridFor, gridSource, gridStatus, siteById } from '../data/dataset'
import { pct } from '../lib/format'
import { bit, cellOffset, centreCell, nearestBetter, pointIndex, visibleHours } from '../lib/grid'
import { C, FONT } from '../lib/theme'
import { OK_FRACTION, windowStats, type Body } from '../lib/visibility'
import { useStore } from '../state/store'
import type { Cell, GridData } from '../types'
import { useCanvas } from './useCanvas'

const SIZE = 560
/** Room around the map for the km ticks and labels. */
const PAD = { l: 54, r: 10, t: 10, b: 40 }
/** The square the map is drawn in, inside a canvas of w x h CSS pixels. */
function plotBox(w: number, h: number) {
  const side = Math.floor(Math.min(w - PAD.l - PAD.r, h - PAD.t - PAD.b))
  return { ox: PAD.l + Math.floor((w - PAD.l - PAD.r - side) / 2), oy: PAD.t, side }
}
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
  const [hover, setHover] = useState<Cell | null>(null)

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
    const { ox, oy, side } = plotBox(w, h)
    const hourNow = Math.min(s0 + t, g.hours - 1)
    // Whole-pixel cell edges, so neighbouring squares meet exactly: no seams and no overlap lines.
    const edge = (k: number) => Math.round((k * side) / g.size)
    const X = (c: number) => ox + edge(c)
    const Y = (r: number) => oy + edge(r)
    const cs = side / g.size
    const mid = (c: Cell): [number, number] => [ox + (c.col + 0.5) * cs, oy + (c.row + 0.5) * cs]
    const [R, G, Bl] = B.rgb.split(',').map(Number)

    for (let r = 0; r < g.size; r++)
      for (let c = 0; c < g.size; c++) {
        const p = r * g.size + c
        // In view: 0..1. "Right now" is all or nothing; "whole mission" is the share of hours.
        const f = mode === 'now' ? (bit(g, body, p, hourNow) ? 1 : 0) : hours[p] / n
        // One clean ramp from near-black straight to the body's colour (eased so low values stay dark),
        // with the relief as a gentle brightness change rather than a grey layer underneath.
        const k = Math.pow(f, 1.6)
        const relief = 0.82 + shade[p] * 0.36
        const ch = (dark: number, full: number) => Math.round(Math.min(255, (dark + (full - dark) * k) * relief))
        ctx.fillStyle = `rgb(${ch(20, R)},${ch(19, G)},${ch(18, Bl)})`
        ctx.fillRect(X(c), Y(r), X(c + 1) - X(c), Y(r + 1) - Y(r))
      }

    // Faint 5 km grid, a hairline frame, and km ticks and labels on the bottom and left edges.
    const kmToPx = (km: number) => ((km * 1000) / g.spacing_m + g.size / 2) * cs
    const halfKm = (g.size * g.spacing_m) / 2000
    ctx.lineWidth = 1
    ctx.font = `11px ${FONT}`
    ctx.fillStyle = C.dim
    for (let km = -Math.floor(halfKm); km <= Math.floor(halfKm); km++) {
      const major = km % 5 === 0
      const px = Math.round(kmToPx(km)) + 0.5
      if (major && Math.abs(km) < halfKm) {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.beginPath()
        ctx.moveTo(ox + px, oy)
        ctx.lineTo(ox + px, oy + side)
        ctx.moveTo(ox, oy + side - px)
        ctx.lineTo(ox + side, oy + side - px)
        ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      const len = major ? 6 : 3
      ctx.beginPath()
      ctx.moveTo(ox + px, oy + side)
      ctx.lineTo(ox + px, oy + side + len)
      ctx.moveTo(ox, oy + side - px)
      ctx.lineTo(ox - len, oy + side - px)
      ctx.stroke()
      if (major) {
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(String(km), ox + px, oy + side + 9)
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(km), ox - 9, oy + side - px)
      }
    }
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText('km east of the site', ox + side, oy + side + 24)
    ctx.save()
    ctx.translate(ox - 46, oy)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText('km north', 0, 0)
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.strokeRect(ox + 0.5, oy + 0.5, side - 1, side - 1)
    // Corner reticle ticks, just outside the frame
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    for (const [cx, cy, dx, dy] of [[ox, oy, -1, -1], [ox + side, oy, 1, -1], [ox, oy + side, -1, 1], [ox + side, oy + side, 1, 1]] as const) {
      ctx.beginPath()
      ctx.moveTo(cx + dx * 4.5, cy - dy * 5)
      ctx.lineTo(cx + dx * 4.5, cy + dy * 4.5)
      ctx.lineTo(cx - dx * 5, cy + dy * 4.5)
      ctx.stroke()
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
      ctx.strokeRect(X(cell.col) + 1, Y(cell.row) + 1, X(cell.col + 1) - X(cell.col) - 2, Y(cell.row + 1) - Y(cell.row) - 2)
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
      const head = (x1: number, y1: number, size: number, spread: number) => {
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x1 - Math.cos(ang - spread) * size, y1 - Math.sin(ang - spread) * size)
        ctx.lineTo(x1 - Math.cos(ang + spread) * size, y1 - Math.sin(ang + spread) * size)
        ctx.closePath()
        ctx.fill()
      }
      if (len > startGap + ringR + 6) {
        const x1 = bx - Math.cos(ang) * (ringR + 2)
        const y1 = by - Math.sin(ang) * (ringR + 2)
        ctx.beginPath()
        ctx.moveTo(ax + Math.cos(ang) * startGap, ay + Math.sin(ang) * startGap)
        ctx.lineTo(x1, y1)
        ctx.stroke()
        head(x1, y1, 9, 0.45)
      } else {
        // Next-door square: no room for a shaft, so just the arrowhead on the ring.
        head(bx - Math.cos(ang) * (ringR - 5), by - Math.sin(ang) * (ringR - 5), 8, 0.6)
      }
      const text = `Move ${better.km.toFixed(1)} km ${better.dir} → +${better.gain_h} h ${B.gain}`
      ctx.font = `500 13px ${FONT}`
      const tw = ctx.measureText(text).width
      const lx = Math.max(ox + 6, Math.min(ox + side - tw - 16, bx - tw / 2 - 5))
      const ly = by - oy > 44 ? by - ringR - 28 : by + ringR + 8
      ctx.fillStyle = 'rgba(9,9,10,0.86)'
      ctx.fillRect(lx, ly, tw + 12, 22)
      ctx.fillStyle = C.ok
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, lx + 6, ly + 11.5)
    }

    // North (up on this map is north at the site)
    ctx.fillStyle = C.text
    ctx.font = `500 12px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('N', ox + side - 16, oy + 8)
    ctx.beginPath()
    ctx.moveTo(ox + side - 16, oy + 24)
    ctx.lineTo(ox + side - 20, oy + 32)
    ctx.lineTo(ox + side - 12, oy + 32)
    ctx.closePath()
    ctx.fill()
  })

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>): Cell | null => {
    if (!g) return null
    const r = e.currentTarget.getBoundingClientRect()
    const { ox, oy, side } = plotBox(r.width, r.height)
    const col = Math.floor(((e.clientX - r.left - ox) / side) * g.size)
    const row = Math.floor(((e.clientY - r.top - oy) / side) * g.size)
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
      <span className="sub">How much {B.word} each spot within 10 km of {name} gets. Pick a square to try it.</span>
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
          onPointerMove={(e) => setHover(e.pointerType === 'mouse' ? cellAt(e) : null)}
          onPointerLeave={() => setHover(null)}
        />
        <p className="readout" aria-hidden="true">
          {hover ? (
            (() => {
              const p = pointIndex(g, hover)
              const o = cellOffset(g, hover)
              const now = bit(g, body, p, Math.min(s0 + t, g.hours - 1))
              const km = (m: number, pos: string, neg: string) => `${Math.abs(m / 1000).toFixed(1)} km ${m >= 0 ? pos : neg}`
              return (
                <>
                  <b>{km(o.east_m, 'east', 'west')}</b>, <b>{km(o.north_m, 'north', 'south')}</b> of the site ·{' '}
                  <b>{hours[p]} h</b> of {n} h with {B.word} ({pct(hours[p] / n)}%) · right now {now ? 'in view' : 'blocked'}
                </>
              )
            })()
          ) : (
            'Move over the map to read a square.'
          )}
        </p>
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
              <span><i className="chip" style={{ background: 'rgb(20,19,18)', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.25)' }} />Blocked by terrain</span>
            </>
          ) : (
            <span className="w-full">
              <i className="ramp" style={{ background: `linear-gradient(90deg, rgb(20,19,18), color-mix(in srgb, rgb(${B.rgb}) 33%, rgb(20,19,18)) 50%, rgb(${B.rgb}))` }} />
              <span className="flex justify-between"><span>0%</span><span>share of the {missionLength}-day mission</span><span>100%</span></span>
            </span>
          )}
        </div>

        {gridSource === 'pipeline' && (
          <p className="note mt-3">
            <b>Coarser than the verdict.</b> The map gives {name} {centreHours} h of {B.word}; the verdict's finer skyline
            gives {siteHours} h.
            {agree !== undefined && agree !== null && <> Over all the data they agree in {pct(agree)}% of hours here.</>}
            {agree !== undefined && agree !== null && agree < 0.99 && ' Treat small gains with caution.'}
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
              {hours[pointIndex(g, better)]} h in all: the closest square that{' '}
              {refHours < Math.ceil(OK_FRACTION * n) && hours[pointIndex(g, better)] >= Math.ceil(OK_FRACTION * n)
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
        <details className="sources">
          <summary>Method and sources</summary>
          <ul>
            <li>
              The 20 km around {name}: {g.size} × {g.size} squares, one every {g.spacing_m} m. A short move can change how
              much {B.word} a lander gets.
            </li>
            <li>
              Each square has its own skyline, traced out to 150 km on {gridSource === 'sample' ? 'sample terrain' : g.meta.dem}, and
              is checked against the Sun and Earth directions hour by hour. "Whole mission" counts the {n} hours from
              landing; "Right now" follows the timeline.
            </li>
            <li>
              Every square here is worked out from 80 m terrain; the verdict at the top of the page uses 20 m terrain for
              the site itself. Coarser terrain smooths small ridges away, so the two can differ for the same spot. Small
              gains suggested by the map are within that margin.
            </li>
            <li>
              Nearest better point: if this spot is under {pct(OK_FRACTION)}%, the closest square that reaches it;
              otherwise the closest square that gains at least 12 hours. The 12 hours is this tool's own cut-off.
            </li>
            <li>A picked square keeps the site's Sun and Earth directions and has no skyline of its own, so the sky view still shows the site's.</li>
            <li>Brightness follows the relief only slightly; colour is the share of hours in view.</li>
          </ul>
        </details>
      </section>
    </>
  )
}
