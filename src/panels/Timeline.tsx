import { useEffect, useRef, useState } from 'react'
import { dataset, dayMs } from '../data/dataset'
import { fmtDT, fmtDur } from '../lib/format'
import { C, FONT } from '../lib/theme'
import { isVisible, type Body } from '../lib/visibility'
import { useStore } from '../state/store'
import { useCanvas } from './useCanvas'
import Tooltip, { type TipState } from './Tooltip'

/** Mission hours shown per second of playback at 1x. */
const HOURS_PER_SECOND = 24

const ROWS: [string, Body, string, number][] = [
  ['Sun', 'sun', C.sun, 4],
  ['Earth', 'earth', C.earth, 20],
]
const BAR_H = 8
const H = 56
const LABEL_W = 52
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Two thin bars: where the Sun and Earth are in view over the mission. Gaps are terrain blocking them. */
export default function Timeline() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const t = useStore((s) => s.t)
  const playing = useStore((s) => s.playing)
  const setT = useStore((s) => s.setT)
  const togglePlay = useStore((s) => s.togglePlay)
  const d = dataset.bySite[site]
  const n = missionLength * 24
  const s0 = landingDay * 24
  const dragging = useRef(false)

  const speed = useStore((s) => s.speed)
  const cycleSpeed = useStore((s) => s.cycleSpeed)
  const [tip, setTip] = useState<TipState | null>(null)

  // Playback on the display's own frame clock, looping at the end of the mission.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const tick = (now: number) => {
      acc += (Math.min(now - last, 100) / 1000) * HOURS_PER_SECOND * speed
      last = now
      const whole = Math.floor(acc)
      if (whole > 0) {
        acc -= whole
        useStore.setState((s) => ({ t: (s.t + whole) % (s.missionLength * 24) }))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  const ref = useCanvas(H, (g, w) => {
    const pw = w - LABEL_W - 8
    const X = (h: number) => LABEL_W + (h / n) * pw

    g.textBaseline = 'middle'
    for (const [name, which, col, y] of ROWS) {
      g.textAlign = 'left'
      g.fillStyle = C.muted
      g.font = `13px ${FONT}`
      g.fillText(name, 0, y + BAR_H / 2 + 1)
      g.fillStyle = 'rgba(255,255,255,0.1)'
      g.beginPath()
      g.roundRect(X(0), y + 3, pw, 2, 1)
      g.fill()
      // Runs of consecutive hours in view
      let k = 0
      while (k < n) {
        if (!isVisible(d, which, s0 + k)) {
          k++
          continue
        }
        let e = k
        while (e < n && isVisible(d, which, s0 + e)) e++
        g.fillStyle = col
        g.beginPath()
        g.roundRect(X(k), y, Math.max(2, X(e) - X(k)), BAR_H, 4)
        g.fill()
        k = e
      }
    }

    // Day ticks with dates
    const every = Math.max(1, Math.ceil(60 / (pw / missionLength)))
    g.font = `12px ${FONT}`
    g.fillStyle = C.dim
    for (let day = 0; day < missionLength; day += every) {
      const date = new Date(dayMs(landingDay + day))
      g.textAlign = day === 0 ? 'left' : 'center'
      g.fillText(`${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`, X(day * 24), 46)
    }

    // Playhead
    const x = X(t + 0.5)
    g.fillStyle = C.text
    g.fillRect(x - 0.75, 0, 1.5, 32)
    g.beginPath()
    g.arc(x, 32, 4, 0, 7)
    g.fill()
  })

  const hourAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left - LABEL_W) / (r.width - LABEL_W - 8)) * n)))
  }
  const scrubTo = (e: React.PointerEvent<HTMLCanvasElement>) => setT(hourAt(e))
  const showTip = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const h = hourAt(e)
    const i = Math.min(s0 + h, d.sun.el.length - 1)
    setTip({
      x: e.clientX,
      y: e.clientY - 96,
      content: (
        <>
          <b>{fmtDT(dayMs(landingDay) + h * 36e5)}</b>
          <br />
          <span className={isVisible(d, 'sun', i) ? 'text-sun' : 'text-bad'}>
            Sun {isVisible(d, 'sun', i) ? 'in view' : 'behind terrain'}
          </span>
          <br />
          <span className={isVisible(d, 'earth', i) ? 'text-earth' : 'text-bad'}>
            Earth {isVisible(d, 'earth', i) ? 'in view' : 'behind terrain'}
          </span>
        </>
      ),
    })
  }

  return (
    <div className="flex items-center gap-4">
      <button className="play" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          {playing ? (
            <>
              <rect x="3" y="2" width="3" height="10" fill={C.text} />
              <rect x="8" y="2" width="3" height="10" fill={C.text} />
            </>
          ) : (
            <path d="M3.5 1.5v11l9-5.5z" fill={C.text} />
          )}
        </svg>
      </button>
      <button className="speed" aria-label={`Playback speed ${speed} times. Change speed`} onClick={cycleSpeed}>
        {speed}×
      </button>
      <div className="min-w-0 flex-1">
        <canvas
          ref={ref}
          style={{ height: H, cursor: 'ew-resize', touchAction: 'pan-y' }}
          role="img"
          aria-label="When the Sun and Earth are in view over the mission. Drag to change the time."
          onPointerDown={(e) => {
            dragging.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            scrubTo(e)
          }}
          onPointerMove={(e) => {
            if (dragging.current) scrubTo(e)
            if (e.pointerType === 'mouse') showTip(e)
          }}
          onPointerLeave={() => setTip(null)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        />
        {/* Keyboard and screen-reader route to the same value as dragging the bars. */}
        <input
          className="sr-only-range"
          type="range"
          min={0}
          max={n - 1}
          value={t}
          aria-label="Time in mission"
          aria-valuetext={`${fmtDur(t)} after landing`}
          onChange={(e) => setT(+e.target.value)}
        />
      </div>
      <div className="hidden w-[190px] flex-none whitespace-nowrap text-right sm:block">
        <div className="text-[15px]">{fmtDT(dayMs(landingDay) + t * 36e5).slice(0, 16)} UTC</div>
        <div className="lbl">{t === 0 ? 'Landing' : `${fmtDur(t)} after landing`}</div>
      </div>
      <Tooltip tip={tip} />
    </div>
  )
}
