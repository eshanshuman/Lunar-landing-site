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

  selectSite: (id: string) => void
  stepSite: (dir: 1 | -1) => void
  selectScenario: (site: string, landingDay: number) => void
  setMissionLength: (days: number) => void
  setT: (t: number) => void
  stepT: (dh: number) => void
  togglePlay: () => void
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
  pin: () => set((s) => ({ pinA: { site: s.site, landingDay: s.landingDay, missionLength: s.missionLength } })),
  unpin: () => set({ pinA: null }),
}))
