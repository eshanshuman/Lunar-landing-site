import { dayMs, siteById } from '../data/dataset'
import { fmtDate } from '../lib/format'
import { C, FONT } from '../lib/theme'
import { DISC_RADIUS_DEG, isMarginal, isVisible, type Body } from '../lib/visibility'
import { useSiteData, useStore } from '../state/store'
import { useCanvas } from './useCanvas'

/** Mean angular radius of the Sun seen from the Moon, degrees (0.53° diameter). */

export default function SkyView() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const missionLength = useStore((s) => s.missionLength)
  const t = useStore((s) => s.t)
  const d = useSiteData()
  const picked = !!d.vis

  const ref = useCanvas(280, (g, w, h) => {
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
    g.font = `12px ${FONT}`
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    const step = hi - lo > 16 ? 4 : hi - lo > 8 ? 2 : 1
    for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) {
      g.strokeStyle = e === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.06)'
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
      g.fillStyle = i % 2 ? C.dim : C.muted
      g.fillText(c, X(i * 45), T + ph + 8)
    })

    // Terrain skyline
    g.beginPath()
    g.moveTo(X(0), Y(lo))
    for (let a = 0; a <= n; a++) g.lineTo(X((a / n) * 360), Y(hor[a % n]))
    g.lineTo(X(360), Y(lo))
    g.closePath()
    const grd = g.createLinearGradient(0, T, 0, T + ph)
    grd.addColorStop(0, '#4a4844')
    grd.addColorStop(1, '#1b1a19')
    g.fillStyle = grd
    g.fill()
    g.strokeStyle = '#8d8982'
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
        // Marginal: the disc straddles the skyline. Same colour as its side of the line, but lighter.
        g.globalAlpha = isMarginal(d, which, i) ? 0.45 : 1
        g.strokeStyle = v ? col : C.bad
        g.setLineDash(v ? [] : [2, 4])
        g.beginPath()
        g.moveTo(X(az[i]), Y(el[i]))
        g.lineTo(X(az[i + 1]), Y(el[i + 1]))
        g.stroke()
      }
      g.globalAlpha = 1
      g.setLineDash([])
    }
    track('sun', C.sun)
    track('earth', C.earth)

    // Bodies at the scrubber time, each at its true angular size on the vertical scale (with a small floor).
    const i = Math.min(s0 + t, s1 - 1)
    const sunR = Math.max(4, (DISC_RADIUS_DEG.sun / (hi - lo)) * ph)
    const earthR = Math.max(5, (DISC_RADIUS_DEG.earth / (hi - lo)) * ph)
    g.fillStyle = C.sun
    g.shadowColor = C.sun
    g.shadowBlur = 14
    g.beginPath()
    g.arc(X(d.sun.az[i]), Y(d.sun.el[i]), sunR, 0, 7)
    g.fill()
    g.shadowBlur = 0
    g.fillStyle = C.earth
    g.beginPath()
    g.arc(X(d.earth.az[i]), Y(d.earth.el[i]), earthR, 0, 7)
    g.fill()
    g.strokeStyle = C.bg
    g.lineWidth = 1.5
    g.stroke()
  })

  return (
    <section className="card">
      <h2>
        The sky from {siteById(site).name}
        <span className="sub">
          Looking all the way round the horizon. The Sun and Earth trace these paths over the {missionLength}-day mission
          from {fmtDate(dayMs(landingDay))}; where a path dips behind the terrain, it is blocked.
        </span>
      </h2>
      <canvas ref={ref} style={{ height: 280 }} role="img" aria-label="Sky view: terrain skyline with Sun and Earth paths" />
      <div className="legend">
        <span><i style={{ background: 'var(--color-sun)' }} />Sun path, visible</span>
        <span><i style={{ background: 'var(--color-earth)' }} />Earth path, visible</span>
        <span><i style={{ background: 'var(--color-bad)' }} />Blocked by terrain</span>
        <span><i style={{ background: 'var(--color-text)', opacity: 0.45 }} />Lighter stretch: disc partly behind the skyline</span>
        <span><i style={{ background: 'var(--color-rock)' }} />Terrain skyline</span>
        {picked && (
          <span className="w-full">
            This is the skyline at {siteById(site).name} itself. The point you picked on the map has no stored skyline;
            the dotted stretches show when it is blocked there.
          </span>
        )}
        <span className="w-full text-dim">Height is stretched so small angles are visible. There is no atmosphere to bend the light.</span>
      </div>
    </section>
  )
}
