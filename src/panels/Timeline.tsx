import { useEffect } from 'react'
import { dataset, dayMs } from '../data/dataset'
import { fmtDT, pct } from '../lib/format'
import { C } from '../lib/theme'
import { isVisible, windowStats, type Body } from '../lib/visibility'
import { useStore } from '../state/store'
import { useCanvas } from './useCanvas'

const ROWS: [string, Body, string, number][] = [
  ['Sunlight', 'sun', C.sun, 6],
  ['Earth', 'earth', C.earth, 34],
]

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
  const st = windowStats(d, s0, n)

  // Playback: 2 mission hours per 40 ms tick, looping (same pace as the prototype).
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => useStore.setState((s) => ({ t: (s.t + 2) % (s.missionLength * 24) })), 40)
    return () => clearInterval(id)
  }, [playing])

  const ref = useCanvas(74, (g, w) => {
    const L = 60
    const pw = w - L - 4
    const rowH = 20
    g.font = '12px Inter, sans-serif'
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    for (const [name, which, col, y] of ROWS) {
      g.fillStyle = C.muted
      g.fillText(name, 0, y + rowH / 2)
      for (let k = 0; k < n; k++) {
        g.fillStyle = isVisible(d, which, s0 + k) ? col : '#4a1e1e'
        g.fillRect(L + (k / n) * pw, y, pw / n + 0.6, rowH)
      }
    }
    g.font = '10px "JetBrains Mono", monospace'
    g.fillStyle = C.dim
    g.textAlign = 'center'
    for (let dd = 0; dd <= missionLength; dd += missionLength > 7 ? 2 : 1) g.fillText(`D${dd}`, L + ((dd * 24) / n) * pw, 66)
    g.fillStyle = C.text
    g.fillRect(L + (t / n) * pw - 1, 2, 2, 54)
  })

  return (
    <section className="card">
      <h2>
        Mission timeline{' '}
        <span className="sub">
          sunlight {pct(st.sunF)}% · Earth contact {pct(st.earthF)}% · longest dark {st.maxDark} h · longest Earth gap{' '}
          {st.maxGap} h
        </span>
      </h2>
      <div className="mb-2 flex items-center gap-3">
        <button className="play" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            {playing ? (
              <>
                <rect x="3" y="2" width="3" height="10" fill={C.text} />
                <rect x="8" y="2" width="3" height="10" fill={C.text} />
              </>
            ) : (
              <path d="M3 1.5v11l9-5.5z" fill={C.text} />
            )}
          </svg>
        </button>
        <input
          className="min-w-0 flex-1"
          type="range"
          min={0}
          max={n - 1}
          value={t}
          aria-label="Time in mission"
          aria-valuetext={`${t} h after landing`}
          onChange={(e) => setT(+e.target.value)}
        />
        <span className="clock">{fmtDT(dayMs(landingDay) + t * 36e5)}</span>
      </div>
      <canvas ref={ref} style={{ height: 74 }} role="img" aria-label="Sunlight and Earth contact over the mission" />
    </section>
  )
}
