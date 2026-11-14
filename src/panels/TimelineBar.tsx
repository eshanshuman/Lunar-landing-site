import { useEffect, useState } from 'react'
import { dayMs } from '../data/dataset'
import { useStore } from '../state/store'
import { placeName } from './ScenarioDiff'
import Timeline from './Timeline'

const shortDate = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/**
 * The timeline, fixed to the bottom of the window so play and scrub are always in reach.
 * Once the first screen has scrolled away it also says which site and date the page is about.
 */
export default function TimelineBar() {
  const revealed = useStore((s) => s.revealed)
  const site = useStore((s) => s.site)
  const cell = useStore((s) => s.cell)
  const landingDay = useStore((s) => s.landingDay)
  const [pastHero, setPastHero] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const hero = document.querySelector('.hero')
      setPastHero(!!hero && hero.getBoundingClientRect().bottom < 140)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className={`timebar${revealed ? '' : ' pre'}`}>
      <div className="timebar-in">
        {pastHero && (
          <div className="timebar-where" aria-live="polite">
            {placeName(site, cell)} · {shortDate(dayMs(landingDay))}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Timeline />
        </div>
      </div>
    </div>
  )
}
