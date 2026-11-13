import { describe, expect, it } from 'vitest'
import { enu, sitePosition, skyDirection, type Vec3 } from './geo'

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const close = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 10))

describe('sitePosition', () => {
  it('puts lon 0 on +X, the north pole on +Y and east longitudes towards -Z', () => {
    close(sitePosition(0, 0), [1, 0, 0])
    close(sitePosition(90, 0), [0, 1, 0])
    close(sitePosition(-90, 123), [0, -1, 0])
    close(sitePosition(0, 90), [0, 0, -1])
  })
})

describe('enu', () => {
  it('is a right-handed orthonormal basis everywhere (east × north = up)', () => {
    for (const [lat, lon] of [[0, 0], [-89.4632, -137.49], [-69.37, 32.32], [45, 170]]) {
      const { e, n, u } = enu(lat, lon)
      for (const v of [e, n, u]) expect(dot(v, v)).toBeCloseTo(1, 10)
      expect(dot(e, n)).toBeCloseTo(0, 10)
      expect(dot(e, u)).toBeCloseTo(0, 10)
      close(cross(e, n), u)
    }
  })
  it('points north towards +Y', () => {
    expect(enu(-80, 20).n[1]).toBeGreaterThan(0)
  })
})

describe('skyDirection', () => {
  it('maps azimuth clockwise from north and elevation above the horizontal', () => {
    close(skyDirection(0, 0, 0, 0), [0, 1, 0]) // north
    close(skyDirection(0, 0, 90, 0), [0, 0, -1]) // east
    close(skyDirection(0, 0, 180, 0), [0, -1, 0]) // south
    close(skyDirection(0, 0, 37, 90), [1, 0, 0]) // zenith
  })
  it('keeps the requested elevation at a polar site', () => {
    const lat = -89.4632, lon = -137.49
    const d = skyDirection(lat, lon, 211, 1.2)
    expect(dot(d, d)).toBeCloseTo(1, 10)
    expect(Math.asin(dot(d, sitePosition(lat, lon))) * (180 / Math.PI)).toBeCloseTo(1.2, 8)
  })
  it('at the south pole every horizontal direction lies in the equatorial plane', () => {
    expect(skyDirection(-90, 0, 73, 0)[1]).toBeCloseTo(0, 10)
  })
})
