import { useEffect } from 'react'
import { useStore } from './state/store'
import Shell from './panels/Shell'

/** Space = play/pause, ←/→ = step hours, ↑/↓ = change site (PLAN.md §8). */
function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      const s = useStore.getState()
      if (s.intro) {
        // Esc, Enter or Space skips the intro. A focused button handles Enter and Space itself.
        if (e.key === 'Escape' || ((e.key === 'Enter' || e.key === ' ') && tag !== 'BUTTON')) {
          s.finishIntro()
          e.preventDefault()
        }
        return
      }
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
  return <Shell />
}
