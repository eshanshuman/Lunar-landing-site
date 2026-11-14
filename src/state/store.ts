import { create } from 'zustand'
import { dataset } from '../data/dataset'
import { introSeen, markIntroSeen, prefersReducedMotion } from '../scenes/Intro/introState'

export interface Pin {
  site: string
  landingDay: number
  missionLength: number
}

interface State {
  /** Selected site id. */
  site: string
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
  /** Site under the pointer in the site list, so the 3D pin can light up. */
  hoverSite: string | null
  /** The intro cinematic is playing. */
  intro: boolean
  /** Seconds into the intro (drives the captions). */
  introTime: number
  /** Site pins and the interface are on screen. False for the first part of the intro. */
  revealed: boolean

  selectSite: (id: string) => void
  stepSite: (dir: 1 | -1) => void
  selectScenario: (site: string, landingDay: number) => void
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
}

const lastHour = (missionLength: number) => missionLength * 24 - 1

// First visit plays the intro. Reduced motion goes straight to the explorer.
const playIntro = typeof window !== 'undefined' && !introSeen() && !prefersReducedMotion()

export const useStore = create<State>((set) => ({
  site: 'ridge',
  landingDay: 15,
  missionLength: 10,
  t: 0,
  playing: false,
  pinA: null,
  speed: 1,
  hoverSite: null,
  intro: playIntro,
  introTime: 0,
  revealed: !playIntro,

  selectSite: (site) => set({ site }),
  stepSite: (dir) =>
    set((s) => {
      const ids = dataset.sites.map((x) => x.id)
      const i = ids.indexOf(s.site)
      return { site: ids[(i + dir + ids.length) % ids.length] }
    }),
  selectScenario: (site, landingDay) => set({ site, landingDay, t: 0 }),
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
  pin: () => set((s) => ({ pinA: { site: s.site, landingDay: s.landingDay, missionLength: s.missionLength } })),
  unpin: () => set({ pinA: null }),
}))
