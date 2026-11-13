import { useEffect } from 'react'
import { useStore } from './state/store'
import Hero from './panels/Hero'
import SkyView from './panels/SkyView'
import SlipGrid from './panels/SlipGrid'
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
      if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'SELECT' && tag !== 'INPUT' && tag !== 'SUMMARY') s.togglePlay()
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
      <Hero />
      <main className="page">
        <div className="band">
          <SlipGrid />
          <ScenarioDiff />
        </div>
        <div className="band">
          <SkyView />
          <Explain />
        </div>
        <div className="band">
          <DataNote />
          <section className="card aside">
            <h2>Keyboard</h2>
            <p className="note">Space plays or pauses. Left and right arrows step one hour. Up and down arrows change site.</p>
          </section>
        </div>
      </main>
    </>
  )
}
