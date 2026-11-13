export const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const fmtDT = (ms: number) => {
  const iso = new Date(ms).toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

export const fmtDur = (h: number | null) =>
  h === null ? 'beyond window' : h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h`

export const compass = (az: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(az / 45) % 8]

export const pct = (f: number) => Math.round(f * 100)
