import { dataset, dayMs, siteById } from '../data/dataset'
import { fmtDate } from '../lib/format'
import { C } from '../lib/theme'
import { isVisible, type Body } from '../lib/visibility'
import { useStore } from '../state/store'
import { useCanvas } from './useCanvas'

/** Mean angular radius of the Sun seen from the Moon, degrees (0.53° diameter). */
const SUN_RADIUS_DEG = 0.265

export default function SkyView() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const t = useStore((s) => s.t)
  const d = dataset.bySite[site]

  const ref = useCanvas(300, (g, w, h) => {
    const hor = d.horizon_deg
    const n = hor.length
    const s0 = landingDay * 24
    const s1 = Math.min(s0 + missionLength * 24, d.sun.el.length)

    // Vertical range adapts to the site: near the pole everything happens within a few degrees.
    let lo = Infinity
    let hi = -Infinity
    for (let a = 0; a < n; a++) {
      lo = Math.min(lo, hor[a])
      hi = Math.max(hi, hor[a])
    }
    for (let i = s0; i < s1; i++) {
      lo = Math.min(lo, d.sun.el[i], d.earth.el[i])
      hi = Math.max(hi, d.sun.el[i], d.earth.el[i])
    }
    lo = Math.floor(Math.min(lo, -1) - 0.5)
    hi = Math.ceil(hi + 1)

    const L = 36, R = 10, T = 12, B = 26
    const pw = w - L - R
    const ph = h - T - B
    const X = (az: number) => L + (az / 360) * pw
    const Y = (el: number) => T + ((hi - el) / (hi - lo)) * ph

    // Elevation grid
    g.font = '11px "JetBrains Mono", monospace'
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    const step = hi - lo > 16 ? 4 : hi - lo > 8 ? 2 : 1
    for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) {
      g.strokeStyle = e === 0 ? '#3a404a' : '#1d2128'
      g.lineWidth = 1
      g.setLineDash(e === 0 ? [4, 4] : [])
      g.beginPath()
      g.moveTo(L, Y(e))
      g.lineTo(L + pw, Y(e))
      g.stroke()
      g.setLineDash([])
      g.fillStyle = C.dim
      g.fillText(`${e}°`, L - 6, Y(e))
    }
    g.textAlign = 'center'
    g.textBaseline = 'top'
    ;['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'].forEach((c, i) => {
      g.fillStyle = i % 2 ? '#4b525b' : C.muted
      g.fillText(c, X(i * 45), T + ph + 8)
    })

    // Terrain skyline
    g.beginPath()
    g.moveTo(X(0), Y(lo))
    for (let a = 0; a <= n; a++) g.lineTo(X((a / n) * 360), Y(hor[a % n]))
    g.lineTo(X(360), Y(lo))
    g.closePath()
    const grd = g.createLinearGradient(0, T, 0, T + ph)
    grd.addColorStop(0, '#666B73')
    grd.addColorStop(1, '#30343A')
    g.fillStyle = grd
    g.fill()
    g.strokeStyle = '#7B8089'
    g.lineWidth = 1.2
    g.beginPath()
    for (let a = 0; a <= n; a++) {
      const x = X((a / n) * 360)
      const y = Y(hor[a % n])
      if (a) g.lineTo(x, y)
      else g.moveTo(x, y)
    }
    g.stroke()

    // Sun and Earth tracks over the mission window; blocked stretches are red and dotted.
    const track = (which: Body, col: string) => {
      const { az, el } = d[which]
      g.lineWidth = 2.4
      g.lineCap = 'round'
      for (let i = s0; i < s1 - 1; i++) {
        if (Math.abs(az[i + 1] - az[i]) > 180) continue // wraps across north
        const v = isVisible(d, which, i)
        g.strokeStyle = v ? col : C.bad
        g.setLineDash(v ? [] : [2, 4])
        g.beginPath()
        g.moveTo(X(az[i]), Y(el[i]))
        g.lineTo(X(az[i + 1]), Y(el[i + 1]))
        g.stroke()
      }
      g.setLineDash([])
    }
    track('sun', C.sun)
    track('earth', C.earth)

    // Bodies at the scrubber time. Sun at true angular size on the vertical scale, 4 px floor.
    const i = Math.min(s0 + t, s1 - 1)
    const sunR = Math.max(4, (SUN_RADIUS_DEG / (hi - lo)) * ph)
    g.fillStyle = C.sun
    g.shadowColor = C.sun
    g.shadowBlur = 14
    g.beginPath()
    g.arc(X(d.sun.az[i]), Y(d.sun.el[i]), sunR, 0, 7)
    g.fill()
    g.shadowBlur = 0
    g.fillStyle = C.earth
    g.beginPath()
    g.arc(X(d.earth.az[i]), Y(d.earth.el[i]), Math.max(5, sunR * 1.2), 0, 7)
    g.fill()
    g.strokeStyle = C.bg
    g.lineWidth = 1.5
    g.stroke()
  })

  return (
    <section className="card">
      <h2>
        Sky view{' '}
        <span className="sub">
          {siteById(site).name} · {missionLength}-day window from {fmtDate(dayMs(landingDay))}
        </span>
      </h2>
      <canvas ref={ref} style={{ height: 300 }} role="img" aria-label="Sky view: terrain skyline with Sun and Earth paths" />
      <div className="legend">
        <span><i style={{ background: 'var(--color-sun)' }} />Sun path, visible</span>
        <span><i style={{ background: 'var(--color-earth)' }} />Earth path, visible</span>
        <span><i style={{ background: 'var(--color-bad)' }} />Blocked by terrain</span>
        <span><i style={{ background: 'var(--color-rock)' }} />Terrain skyline</span>
        <span className="ml-auto text-dim">
          Vertical scale exaggerated · no atmosphere, so the horizon is terrain + the Moon's curve
        </span>
      </div>
    </section>
  )
}
