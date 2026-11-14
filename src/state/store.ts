import { create } from 'zustand'
import { dataFor, dataset, gridFor, onGridsChanged } from '../data/dataset'
import { isCentre } from '../lib/grid'
import { PRESETS } from '../data/presets'
import type { Cell } from '../types'
import { introSeen, markIntroSeen, prefersReducedMotion } from '../scenes/Intro/introState'

export interface Pin {
  site: string
  cell: Cell | null
  landingDay: number
  missionLength: number
}

interface State {
  /** Selected site id. */
  site: string
  /** A point picked on the site's Sunlight map; null means the named site itself. */
  cell: Cell | null
  /** Landing-date column: days after dataset.startMs. */
  landingDay: number
  /** Mission length in days. */
  missionLength: number
  /** Scrubber position: hours since landing. */
  t: number
  playing: boolean
  /** "Plan A" for the scenario diff. */
  pinA: Pin | null
  /** Playback speed multiplier. */
  speed: number
  /** Mission shown in the backtest panel (index into backtest.json). */
  backtestPick: number
  /** Site under the pointer in the site list, so the 3D pin can light up. */
  hoverSite: string | null
  /** Goes up each time a Sunlight-map grid finishes loading, so views that read grids redraw. */
  gridTick: number
  /** The intro cinematic is playing. */
  intro: boolean
  /** Seconds into the intro (drives the captions). */
  introTime: number
  /** Site pins and the interface are on screen. False for the first part of the intro. */
  revealed: boolean

  selectSite: (id: string) => void
  setCell: (cell: Cell | null) => void
  stepSite: (dir: 1 | -1) => void
  selectScenario: (site: string, landingDay: number, cell?: Cell | null) => void
  setMissionLength: (days: number) => void
  setT: (t: number) => void
  stepT: (dh: number) => void
  togglePlay: () => void
  cycleSpeed: () => void
  setHoverSite: (id: string | null) => void
  finishIntro: () => void
  replayIntro: () => void
  setRevealed: (v: boolean) => void
  setIntroTime: (t: number) => void
  pin: () => void
  unpin: () => void
  setBacktestPick: (i: number) => void
  /** Load a demo preset; returns the element id to scroll to, if any. */
  loadPreset: (id: string) => string | null
}

const lastHour = (missionLength: number) => missionLength * 24 - 1

// First visit plays the intro. Reduced motion goes straight to the explorer.
const playIntro = typeof window !== 'undefined' && !introSeen() && !prefersReducedMotion()

export const useStore = create<State>((set) => ({
  site: 'ridge',
  cell: null,
  landingDay: 15,
  missionLength: 10,
  t: 0,
  playing: false,
  pinA: null,
  speed: 1,
  hoverSite: null,
  gridTick: 0,
  backtestPick: 0,
  intro: playIntro,
  introTime: 0,
  revealed: !playIntro,

  selectSite: (site) => set({ site, cell: null }),
  setCell: (cell) =>
    set((s) => {
      const g = gridFor(s.site)
      return { cell: cell && g && !isCentre(g, cell) ? cell : null }
    }),
  stepSite: (dir) =>
    set((s) => {
      const ids = dataset.sites.map((x) => x.id)
      const i = ids.indexOf(s.site)
      return { site: ids[(i + dir + ids.length) % ids.length], cell: null }
    }),
  // Slipping the date keeps a picked map point; changing site drops it.
  selectScenario: (site, landingDay, cell) =>
    set((s) => ({ site, landingDay, t: 0, cell: cell !== undefined ? cell : site === s.site ? s.cell : null })),
  setMissionLength: (missionLength) => set((s) => ({ missionLength, t: Math.min(s.t, lastHour(missionLength)) })),
  setT: (t) => set((s) => ({ t: Math.max(0, Math.min(lastHour(s.missionLength), Math.round(t))) })),
  stepT: (dh) => set((s) => ({ t: Math.max(0, Math.min(lastHour(s.missionLength), s.t + dh)) })),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  cycleSpeed: () => set((s) => ({ speed: s.speed >= 4 ? 1 : s.speed * 2 })),
  setHoverSite: (hoverSite) => set({ hoverSite }),
  finishIntro: () => {
    markIntroSeen()
    set({ intro: false, revealed: true, introTime: 0 })
  },
  replayIntro: () => set({ intro: true, revealed: false, introTime: 0, playing: false }),
  setRevealed: (revealed) => set({ revealed }),
  // Captions only change a few times, so skip the store update unless a tenth of a second has passed.
  setIntroTime: (t) => set((s) => (Math.abs(t - s.introTime) >= 0.1 ? { introTime: t } : s)),
  pin: () => set((s) => ({ pinA: { site: s.site, cell: s.cell, landingDay: s.landingDay, missionLength: s.missionLength } })),
  unpin: () => set({ pinA: null }),
  setBacktestPick: (backtestPick) => set({ backtestPick }),
  loadPreset: (id) => {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return null
    if (p.kind === 'backtest') {
      set({ backtestPick: p.mission })
      return 'backtest'
    }
    set({ site: p.site, cell: null, landingDay: p.landingDay, missionLength: p.missionLength, t: 0, playing: false })
    return null
  },
}))

/** Data for what is selected now: the named site, or the map point picked on it. */
export const useSiteData = () => useStore((s) => dataFor(s.site, s.cell))

onGridsChanged(() => useStore.setState((s) => ({ gridTick: s.gridTick + 1 })))
