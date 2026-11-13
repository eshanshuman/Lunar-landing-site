import { useEffect, useRef, useState } from 'react'

/** Eases a displayed number towards `value` over `ms`. Jumps straight there under reduced motion. */
export function useTween(value: number, ms = 450): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      from.current = value
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const v = start + (value - start) * (1 - Math.pow(1 - p, 3))
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}
