import { useEffect } from 'react'
import { dataset } from './data/dataset'
import { useStore } from './state/store'
import MoonPlaceholder from './scenes/Moon/MoonPlaceholder'
import SitesPanel from './panels/SitesPanel'
import SkyView from './panels/SkyView'
import Timeline from './panels/Timeline'
import SlipGrid from './panels/SlipGrid'
import RightNow from './panels/RightNow'
import ScenarioDiff from './panels/ScenarioDiff'
import Explain from './panels/Explain'
import DataNote from './panels/DataNote'

/** Space = play/pause, ←/→ = step hours, ↑/↓ = change site (PLAN.md §8). */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      const s = useStore.getState()
      // Leave native behaviour alone where the focused control already uses the key.
      if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'SELECT' && tag !== 'INPUT') s.togglePlay()
      else if (e.key === 'ArrowLeft' && tag !== 'INPUT' && tag !== 'SELECT') s.stepT(-1)
      else if (e.key === 'ArrowRight' && tag !== 'INPUT' && tag !== 'SELECT') s.stepT(1)
      else if (e.key === 'ArrowUp' && tag !== 'INPUT' && tag !== 'SELECT') s.stepSite(-1)
      else if (e.key === 'ArrowDown' && tag !== 'INPUT' && tag !== 'SELECT') s.stepSite(1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export default function App() {
  useKeyboard()
  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5">
        <h1 className="text-base font-bold tracking-[.2px]">Lunar Landing Site Navigator</h1>
        <span className="text-[13px] text-muted">What if we slip? Compare sites and landing dates in seconds</span>
        {dataset.source === 'sample' && (
          <span
            className="badge ml-auto"
            title="Sun/Earth tracks and terrain skylines are synthetic stand-ins with realistic shapes. Real JPL Horizons + LOLA data replaces them when the pipeline lands."
          >
            Sample data · not real values
          </span>
        )}
      </header>

      <main className="wrap">
        <div className="col">
          <SitesPanel />
          <section className="card">
            <h2>How to read this</h2>
            <p className="note">
              Pick a <b>site</b> and a <b>landing date</b> in the slip grid. The sky view shows where the Sun and Earth
              travel during the mission, and where terrain blocks them. Press <b>Pin as plan A</b>, then click another
              cell to see what a slip or a site change costs.
            </p>
            <p className="note mt-2">
              Keys: <b>Space</b> play/pause · <b>←/→</b> step one hour · <b>↑/↓</b> change site.
            </p>
          </section>
        </div>

        <div className="col">
          <MoonPlaceholder />
          <SkyView />
          <Timeline />
          <SlipGrid />
        </div>

        <div className="col">
          <RightNow />
          <ScenarioDiff />
          <Explain />
          <DataNote />
        </div>
      </main>
    </>
  )
}
