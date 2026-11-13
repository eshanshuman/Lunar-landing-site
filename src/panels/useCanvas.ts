import { useEffect, useRef } from 'react'

export type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void

/**
 * Canvas 2D at device resolution with a fixed CSS height. `draw` runs on every render,
 * on resize, and once the web fonts are ready.
 */
export function useCanvas(height: number, draw: Draw) {
  const ref = useRef<HTMLCanvasElement>(null)
  const latest = useRef(draw)
  latest.current = draw

  const paint = () => {
    const cv = ref.current
    if (!cv) return
    const r = window.devicePixelRatio || 1
    const w = cv.clientWidth
    if (!w) return
    if (cv.width !== Math.round(w * r) || cv.height !== Math.round(height * r)) {
      cv.width = Math.round(w * r)
      cv.height = Math.round(height * r)
    }
    const g = cv.getContext('2d')
    if (!g) return
    g.setTransform(r, 0, 0, r, 0, 0)
    g.clearRect(0, 0, w, height)
    latest.current(g, w, height)
  }

  useEffect(paint)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ro = new ResizeObserver(paint)
    ro.observe(cv)
    let alive = true
    document.fonts?.ready.then(() => alive && paint())
    return () => {
      alive = false
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ref
}
