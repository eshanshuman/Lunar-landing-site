import { create } from 'zustand'
import { dataset } from '../data/dataset'

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

  selectSite: (id: string) => void
  stepSite: (dir: 1 | -1) => void
  selectScenario: (site: string, landingDay: number) => void
  setMissionLength: (days: number) => void
  setT: (t: number) => void
  stepT: (dh: number) => void
  togglePlay: () => void
  cycleSpeed: () => void
  setHoverSite: (id: string | null) => void
  pin: () => void
  unpin: () => void
}

const lastHour = (missionLength: number) => missionLength * 24 - 1

export const useStore = create<State>((set) => ({
  site: 'ridge',
  landingDay: 15,
  missionLength: 10,
  t: 0,
  playing: false,
  pinA: null,
  speed: 1,
  hoverSite: null,

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
  pin: () => set((s) => ({ pinA: { site: s.site, landingDay: s.landingDay, missionLength: s.missionLength } })),
  unpin: () => set({ pinA: null }),
}))
