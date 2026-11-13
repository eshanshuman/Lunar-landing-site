/**
 * Moon-fixed scene frame, unit sphere = mean lunar radius (1737.4 km).
 * +Y is the north pole, longitude 0° is +X and east longitude increases towards -Z.
 * This matches how three.js wraps a 0°-centred equirectangular map on a SphereGeometry.
 */
export type Vec3 = [number, number, number]

const D2R = Math.PI / 180

/** Unit vector from the Moon's centre to (lat, east lon). Also the local "up". */
export function sitePosition(lat: number, lon: number): Vec3 {
  const la = lat * D2R
  const lo = lon * D2R
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)]
}

/** Local east, north, up unit vectors at (lat, lon). */
export function enu(lat: number, lon: number): { e: Vec3; n: Vec3; u: Vec3 } {
  const la = lat * D2R
  const lo = lon * D2R
  return {
    e: [-Math.sin(lo), 0, -Math.cos(lo)],
    n: [-Math.sin(la) * Math.cos(lo), Math.cos(la), Math.sin(la) * Math.sin(lo)],
    u: sitePosition(lat, lon),
  }
}

/**
 * Scene-frame unit vector towards a body seen from (lat, lon) at azimuth `az`
 * (degrees clockwise from north) and elevation `el` (degrees above the local horizontal).
 */
export function skyDirection(lat: number, lon: number, az: number, el: number): Vec3 {
  const { e, n, u } = enu(lat, lon)
  const a = az * D2R
  const h = el * D2R
  const ce = Math.cos(h) * Math.sin(a)
  const cn = Math.cos(h) * Math.cos(a)
  const cu = Math.sin(h)
  return [e[0] * ce + n[0] * cn + u[0] * cu, e[1] * ce + n[1] * cn + u[1] * cu, e[2] * ce + n[2] * cn + u[2] * cu]
}
