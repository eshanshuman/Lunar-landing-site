import type { ReactNode } from 'react'

export interface TipState {
  x: number
  y: number
  content: ReactNode
}

export default function Tooltip({ tip }: { tip: TipState | null }) {
  if (!tip) return null
  return (
    <div className="tip" role="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 260), top: tip.y + 14 }}>
      {tip.content}
    </div>
  )
}
