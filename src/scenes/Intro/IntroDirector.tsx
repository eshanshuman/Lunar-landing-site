/**
 * Scene 0: the intro cinematic (PLAN.md §3, milestone M4). Runs inside the Moon explorer's own
 * canvas and drives its camera, so the last frame IS the explorer's opening view: no cut.
 *
 *   0–2 s   night-side Earth, the rocket lifts off
 *   2–5 s   the camera rides ahead of the rocket; Earth shrinks behind the glowing trajectory
 *   5–8 s   the Moon grows and the camera swings under the South Pole
 *   8–11 s  dive to the selected site; pins and interface come in
 *   11–12 s settle
 *
 * Distances and sizes are staged for the shot, not to scale. Directions to the Sun and Earth
 * are the same ones the explorer uses for the selected site.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Line2 } from 'three-stdlib'
import { dataset, siteById } from '../../data/dataset'
import { useStore } from '../../state/store'
import { skyDirection } from '../Moon/geo'
import Rocket from './Rocket'
import { INTRO_SECONDS, REVEAL_AT } from './introState'

const BASE = import.meta.env.BASE_URL
const EARTH_DIST = 17
const EARTH_R = 1.7
const ROCKET_LEN = 0.11
const TRAIL_POINTS = 160

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2])
const smooth = (x: number) => {
  const c = THREE.MathUtils.clamp(x, 0, 1)
  return c * c * (3 - 2 * c)
}
const lerp = THREE.MathUtils.lerp

/** How far along its path the rocket is at time t (0..1): a slow lift-off, a long coast, a gentle arrival. */
function rocketU(t: number) {
  if (t < 2) return 0.035 * smooth(t / 2) * (t / 2)
  if (t < 5.4) return lerp(0.035, 0.8, smooth((t - 2) / 3.4) * 0.55 + ((t - 2) / 3.4) * 0.45)
  return lerp(0.8, 1, smooth((t - 5.4) / 3))
}

function Earth({ position, sunDir, onReady }: { position: THREE.Vector3; sunDir: THREE.Vector3; onReady: () => void }) {
  const [day, night] = useTexture([`${BASE}textures/earth_day_2k.jpg`, `${BASE}textures/earth_night_2k.jpg`])
  useEffect(onReady, [onReady])
  // Day map where the Sun reaches, city lights where it does not, and a thin blue limb of air.
  const [surface, rim] = useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace
    night.colorSpace = THREE.SRGBColorSpace
    const vertexShader = `varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`
    const surface = new THREE.ShaderMaterial({
      uniforms: { sun: { value: sunDir.clone() }, dayMap: { value: day }, nightMap: { value: night } },
      vertexShader,
      fragmentShader: `uniform vec3 sun; uniform sampler2D dayMap; uniform sampler2D nightMap; varying vec3 vN; varying vec2 vUv;
        void main(){
          float d = dot(normalize(vN), sun);
          vec3 lit = texture2D(dayMap, vUv).rgb * smoothstep(-0.08, 0.5, d) * 1.15;
          vec3 dark = texture2D(nightMap, vUv).rgb * (1.0 - smoothstep(-0.2, 0.12, d)) * 1.6;
          gl_FragColor = vec4(lit + dark, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    const rim = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: { sun: { value: sunDir.clone() } },
      vertexShader,
      fragmentShader: `uniform vec3 sun; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 v = normalize(cameraPosition - vW); float edge = pow(1.0 - abs(dot(v, vN)), 2.6); float lit = 0.1 + 0.9 * smoothstep(-0.25, 0.5, dot(vN, sun)); gl_FragColor = vec4(vec3(0.42, 0.66, 1.0) * edge * lit * 1.5, 1.0); }`,
    })
    return [surface, rim]
  }, [day, night, sunDir])
  return (
    <group position={position}>
      <mesh rotation={[0, 2.2, 0]} material={surface}>
        <sphereGeometry args={[EARTH_R, 96, 48]} />
      </mesh>
      <mesh material={rim}>
        <sphereGeometry args={[EARTH_R * 1.045, 64, 32]} />
      </mesh>
    </group>
  )
}

export default function IntroDirector({ moonReady, finalSpot }: { moonReady: boolean; finalSpot: THREE.Vector3 }) {
  const { camera, invalidate } = useThree()
  const finishIntro = useStore((s) => s.finishIntro)
  const setRevealed = useStore((s) => s.setRevealed)
  const setIntroTime = useStore((s) => s.setIntroTime)

  // Freeze the staging at the moment the intro starts.
  const stage = useMemo(() => {
    const st = useStore.getState()
    const s = siteById(st.site)
    const d = dataset.bySite[st.site]
    const i = Math.min(st.landingDay * 24 + st.t, d.sun.el.length - 1)
    const sunDir = v3(skyDirection(s.lat, s.lon, d.sun.az[i], d.sun.el[i]))
    const earthDir = v3(skyDirection(s.lat, s.lon, d.earth.az[i], d.earth.el[i]))
    const earthPos = earthDir.clone().multiplyScalar(EARTH_DIST)
    const toMoon = earthDir.clone().negate()

    // Launch from the night side, on the face turned towards the Moon.
    const night = sunDir.clone().negate()
    night.addScaledVector(toMoon, -night.dot(toMoon)).normalize() // night direction, square to the Earth–Moon line
    const n0 = night.clone().multiplyScalar(0.8).addScaledVector(toMoon, 0.6).normalize()
    const side = new THREE.Vector3().crossVectors(toMoon, night).normalize()
    const pad = earthPos.clone().addScaledVector(n0, EARTH_R)

    const arrive = finalSpot.clone().normalize().multiplyScalar(1.75).addScaledVector(side, 0.9)
    const path = new THREE.CatmullRomCurve3(
      [
        pad,
        pad.clone().addScaledVector(n0, 0.5),
        earthPos.clone().addScaledVector(n0.clone().addScaledVector(toMoon, 0.9).normalize(), EARTH_R + 2.2),
        earthPos.clone().lerp(arrive, 0.55).addScaledVector(night, 1.6),
        earthPos.clone().lerp(arrive, 0.85).addScaledVector(night, 0.5),
        arrive,
      ],
      false,
      'centripetal',
    )

    // Camera and look-at keyframes. Times in seconds.
    const R = (t: number) => path.getPoint(rocketU(t))
    const T = (t: number) => path.getTangent(rocketU(t))
    const ahead = (t: number, f: number, s2: number, up: number) =>
      R(t).addScaledVector(T(t), f).addScaledVector(side, s2).addScaledVector(night, up)
    const under = finalSpot.clone().normalize()
    const keys: [number, THREE.Vector3, THREE.Vector3][] = [
      [0, pad.clone().addScaledVector(n0, 0.42).addScaledVector(side, 0.6).addScaledVector(toMoon, 0.25), pad.clone().addScaledVector(n0, 0.1)],
      [2, pad.clone().addScaledVector(n0, 0.62).addScaledVector(side, 0.72).addScaledVector(toMoon, 0.4), R(2)],
      // Riding ahead of the rocket and looking back, so Earth shrinks behind it.
      [3.4, ahead(3.4, 1.5, 0.9, 0.5), R(3.4).lerp(earthPos, 0.3)],
      [5, ahead(5, 2.6, 1.2, 0.9), R(5).lerp(earthPos, 0.18)],
      [6.6, under.clone().multiplyScalar(8.6).addScaledVector(side, 3.4).addScaledVector(night, 1.2), new THREE.Vector3().lerp(R(6.6), 0.25)],
      [8.2, under.clone().multiplyScalar(7.4).addScaledVector(side, 0.9), new THREE.Vector3()],
      [11, finalSpot.clone(), new THREE.Vector3()],
    ]
    const times = keys.map((k) => k[0])
    const posCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[1]), false, 'centripetal')
    const lookCurve = new THREE.CatmullRomCurve3(keys.map((k) => k[2]), false, 'centripetal')
    // CatmullRomCurve3.getPoint(u) is uniform per segment, so map time to (segment + fraction).
    const param = (t: number) => {
      const last = times.length - 1
      if (t >= times[last]) return 1
      let k = 0
      while (k < last - 1 && t >= times[k + 1]) k++
      let f = (t - times[k]) / (times[k + 1] - times[k])
      if (k === last - 1) f = 1 - Math.pow(1 - f, 2.4) // ease into the final view
      return (k + f) / last
    }
    return { sunDir, earthPos, path, posCurve, lookCurve, param }
  }, [finalSpot])

  const clock = useRef(0)
  const waited = useRef(0)
  const earthReady = useRef(false)
  const onEarthReady = useCallback(() => {
    earthReady.current = true
  }, [])
  const revealed = useRef(false)
  const rocket = useRef<THREE.Group>(null)
  const rocketWrap = useRef<THREE.Group>(null)
  const earth = useRef<THREE.Group>(null)
  const trail = useRef<Line2>(null)
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), l: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion() }), [])
  const trailBuf = useMemo(() => new Float32Array(TRAIL_POINTS * 3), [])

  useEffect(() => {
    invalidate()
    return () => {
      camera.up.set(0, 1, 0)
    }
  }, [camera, invalidate])

  useFrame((_, dt) => {
    // The Moon's textures load while we are still at Earth. If they are late, hold just before the Moon shot.
    // Likewise wait (briefly) for Earth before the first shot, so it never opens on an empty sky.
    waited.current += dt
    const earthOk = earthReady.current || waited.current > 2.5
    if (earthOk && (clock.current < 4.6 || moonReady)) clock.current += Math.min(dt, 0.1)
    const t = clock.current
    setIntroTime(t)

    const u = stage.param(t)
    camera.position.copy(stage.posCurve.getPoint(u, tmp.p))
    camera.up.set(0, 1, 0)
    camera.lookAt(stage.lookCurve.getPoint(u, tmp.l))

    const ru = rocketU(t)
    if (rocketWrap.current && rocket.current) {
      stage.path.getPoint(ru, rocketWrap.current.position)
      tmp.q.setFromUnitVectors(tmp.up, stage.path.getTangent(ru, tmp.l))
      rocket.current.quaternion.copy(tmp.q)
      // Seen from far away the rocket is a point of light; it is gone by the time the pins arrive.
      const fade = 1 - smooth((t - 7.2) / 1.2)
      const far = camera.position.distanceTo(rocketWrap.current.position)
      rocketWrap.current.scale.setScalar(Math.max(ROCKET_LEN, far * 0.02) * fade)
      rocketWrap.current.visible = fade > 0.01
    }
    if (trail.current) {
      const n = Math.max(2, Math.ceil(ru * TRAIL_POINTS))
      for (let k = 0; k < TRAIL_POINTS; k++) {
        stage.path.getPoint((Math.min(k, n - 1) / (n - 1)) * ru, tmp.l)
        trailBuf.set([tmp.l.x, tmp.l.y, tmp.l.z], k * 3)
      }
      trail.current.geometry.setPositions(trailBuf)
      const m = trail.current.material
      m.opacity = 0.9 * (1 - smooth((t - 7) / 1.5))
    }
    if (earth.current) earth.current.visible = t < 9.5

    if (!revealed.current && t >= REVEAL_AT) {
      revealed.current = true
      setRevealed(true)
    }
    if (t >= INTRO_SECONDS) {
      camera.position.copy(finalSpot)
      camera.lookAt(0, 0, 0)
      finishIntro()
    }
    invalidate()
  })

  return (
    <>
      <group ref={earth}>
        <Suspense fallback={null}>
          <Earth position={stage.earthPos} sunDir={stage.sunDir} onReady={onEarthReady} />
        </Suspense>
      </group>
      <Line ref={trail} points={[[0, 0, 0], [0, 0, 1]]} color="#ffe2b0" lineWidth={1.6} transparent opacity={0.9} />
      <group ref={rocketWrap}>
        <Rocket ref={rocket} />
      </group>
    </>
  )
}
