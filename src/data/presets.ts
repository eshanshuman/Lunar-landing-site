/**
 * One-click scenarios for the demo (scope item 6).
 * The Artemis IV-style landing is a planning scenario: NASA has not announced this date or site.
 * Its day was picked from the real data: landing 5 Oct 2028 at Shackleton rim gives full sunlight and Earth
 * contact for a 7-day stay; slipping one week (12 Oct) drops Earth contact to a few per cent.
 */
export type Preset =
  | { id: string; label: string; note: string; kind: 'scenario'; site: string; landingDay: number; missionLength: number }
  | { id: string; label: string; note: string; kind: 'backtest'; mission: number }

export const PRESETS: Preset[] = [
  {
    id: 'artemis4',
    label: 'Artemis IV scenario, Oct 2028',
    note: 'Planning scenario, not an announced date or site. Crew of four, 7 days at Shackleton rim.',
    kind: 'scenario',
    site: 'shack',
    landingDay: 4,
    missionLength: 7,
  },
  {
    id: 'im1',
    label: 'IM-1 Odysseus, Feb 2024 (real)',
    note: 'A real landing at Malapert A: our predicted sunset against what happened.',
    kind: 'backtest',
    mission: 0,
  },
]
