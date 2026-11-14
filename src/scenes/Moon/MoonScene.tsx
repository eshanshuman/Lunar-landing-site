/**
 * Scene 1: the 3D Moon explorer (PLAN.md §3, milestone M2).
 * The Sun light, the Earth marker and both sight lines come from the selected site's
 * Sun / Earth azimuth and elevation at the store's time. Everything eases towards its
 * new place, so changing site, date or time never snaps.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Line2 } from 'three-stdlib'
import { dataset, siteById } from '../../data/dataset'
import { C } from '../../lib/theme'
import { earthVisible, sunVisible } from '../../lib/visibility'
import { useStore } from '../../state/store'
import IntroDirector from '../Intro/IntroDirector'
import { sitePosition, skyDirection } from './geo'

const BASE = import.meta.env.BASE_URL
/** Range of the SVS ldem_4 elevation map in km (read from the file when it was converted; see SOURCES.md). */
const LDEM_MIN_KM = -8.8785
const LDEM_MAX_KM = 10.504
const R_KM = 1737.4
/** Markers and lines float this far above the mean sphere so the relief does not swallow them. */
const LIFT = 1.006
/** Display length of the sight lines, in lunar radii. Directions are exact; distances are not to scale. */
const SIGHT = 1.35

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2])
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

function Moon({ onReady }: { onReady: () => void }) {
  const [color, ldem] = useTexture([`${BASE}textures/moon_color_4k.jpg`, `${BASE}textures/moon_ldem_4.png`])
  const gl = useThree((s) => s.gl)
  useMemo(() => {
    color.colorSpace = THREE.SRGBColorSpace
    color.anisotropy = gl.capabilities.getMaxAnisotropy()
  }, [color, gl])
  useEffect(onReady, [onReady])
  return (
    <mesh>
      <sphereGeometry args={[1, 360, 180]} />
      {/* True-scale relief: the Moon's ±10 km is about half a percent of its radius. */}
      <meshStandardMaterial
        map={color}
        displacementMap={ldem}
        displacementScale={(LDEM_MAX_KM - LDEM_MIN_KM) / R_KM}
        displacementBias={LDEM_MIN_KM / R_KM}
        bumpMap={ldem}
        bumpScale={6}
        roughness={1}
        metalness={0}
      />
    </mesh>
  )
}

/** Keeps its children the same size on screen whatever the zoom. */
function ScreenScale({ k = 0.011, children }: { k?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const world = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const g = ref.current
    if (g) g.scale.setScalar(camera.position.distanceTo(g.getWorldPosition(world)) * k)
  })
  return <group ref={ref}>{children}</group>
}

function Pins() {
  const site = useStore((s) => s.site)
  const listHover = useStore((s) => s.hoverSite)
  const selectSite = useStore((s) => s.selectSite)
  const [hover, setHover] = useState<string | null>(null)
  const { gl } = useThree()

  return (
    <>
      {dataset.sites.map((s) => {
        const up = v3(sitePosition(s.lat, s.lon))
        const on = s.id === site
        const hot = hover === s.id || listHover === s.id
        const facing = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up)
        return (
          <group key={s.id} position={up.clone().multiplyScalar(LIFT)}>
            <ScreenScale>
              <mesh
                onClick={(e) => {
                  if (!useStore.getState().revealed) return
                  e.stopPropagation()
                  selectSite(s.id)
                }}
                onPointerOver={(e) => {
                  if (!useStore.getState().revealed) return
                  e.stopPropagation()
                  setHover(s.id)
                  gl.domElement.style.cursor = 'pointer'
                }}
                onPointerOut={() => {
                  setHover(null)
                  gl.domElement.style.cursor = ''
                }}
              >
                {/* Generous invisible hit target around the dot. */}
                <sphereGeometry args={[1.6, 12, 12]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <mesh scale={on ? 0.5 : hot ? 0.5 : 0.36}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color={on || hot ? C.text : '#bdb9b1'} />
              </mesh>
              {(on || hot) && (
                <mesh quaternion={facing}>
                  <ringGeometry args={[1.2, on ? 1.36 : 1.28, 48]} />
                  <meshBasicMaterial color={C.text} side={THREE.DoubleSide} transparent opacity={on ? 1 : 0.6} />
                </mesh>
              )}
              {/* Always mounted; shown for the selected or hovered site. */}
              <Html zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                <div className={`pin-label${on ? ' on' : ''}${on || hot ? '' : ' off'}`}>{s.name}</div>
              </Html>
            </ScreenScale>
          </group>
        )
      })}
    </>
  )
}

/** Sun light, Earth marker and the two sight lines for the selected site and time. */
function Sky({ mounted }: { mounted: boolean }) {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const t = useStore((s) => s.t)
  const revealed = useStore((s) => s.revealed)
  const invalidate = useThree((s) => s.invalidate)
  const s = siteById(site)
  const d = dataset.bySite[site]
  const i = Math.min(landingDay * 24 + t, d.sun.el.length - 1)
  const sunClear = sunVisible(d, i)
  const earthClear = earthVisible(d, i)

  // Where things should be now. The frame loop eases the drawn state towards this.
  const target = useRef({ from: new THREE.Vector3(), sun: new THREE.Vector3(), earth: new THREE.Vector3() })
  target.current.from.copy(v3(sitePosition(s.lat, s.lon))).multiplyScalar(LIFT)
  target.current.sun.copy(v3(skyDirection(s.lat, s.lon, d.sun.az[i], d.sun.el[i])))
  target.current.earth.copy(v3(skyDirection(s.lat, s.lon, d.earth.az[i], d.earth.el[i])))
  const cur = useRef<typeof target.current | null>(null)

  const light = useRef<THREE.DirectionalLight>(null)
  const sunLine = useRef<Line2>(null)
  const earthLine = useRef<Line2>(null)
  const sunEnd = useRef<THREE.Group>(null)
  const earthEnd = useRef<THREE.Group>(null)
  const sunMid = useRef<THREE.Group>(null)
  const earthMid = useRef<THREE.Group>(null)
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3() }), [])

  useEffect(() => invalidate(), [site, i, revealed, mounted, invalidate])

  useFrame((_, dt) => {
    const to = target.current
    if (!cur.current) cur.current = { from: to.from.clone(), sun: to.sun.clone(), earth: to.earth.clone() }
    const c = cur.current
    const k = reducedMotion() ? 1 : 1 - Math.exp(-Math.min(dt, 1 / 30) * 9)
    c.from.lerp(to.from, k)
    c.sun.lerp(to.sun, k).normalize()
    c.earth.lerp(to.earth, k).normalize()

    light.current?.position.copy(c.sun).multiplyScalar(50)
    const place = (dir: THREE.Vector3, line: Line2 | null, end: THREE.Group | null, mid: THREE.Group | null) => {
      tmp.a.copy(c.from)
      tmp.b.copy(c.from).addScaledVector(dir, SIGHT)
      if (line) {
        line.geometry.setPositions([tmp.a.x, tmp.a.y, tmp.a.z, tmp.b.x, tmp.b.y, tmp.b.z])
        line.computeLineDistances()
      }
      end?.position.copy(tmp.b)
      mid?.position.copy(tmp.a).lerp(tmp.b, 0.5)
    }
    place(c.sun, sunLine.current, sunEnd.current, sunMid.current)
    place(c.earth, earthLine.current, earthEnd.current, earthMid.current)

    const settled =
      c.from.distanceToSquared(to.from) < 1e-9 && c.sun.distanceToSquared(to.sun) < 1e-9 && c.earth.distanceToSquared(to.earth) < 1e-9
    if (!settled) invalidate()
  })

  const O: [number, number, number][] = [[0, 0, 0], [0, 0, 1]]
  return (
    <>
      <ambientLight intensity={0.035} />
      <directionalLight ref={light} intensity={3.4} />
      {/* Hidden, not unmounted, until the intro reveals the interface. Labels stay mounted and switch with a class,
          and nothing with a label mounts before the Moon is in: labels mounted on the very first frame
          did not attach reliably. */}
      {mounted && (
      <group visible={revealed}>
      <Line ref={sunLine} points={O} color={sunClear ? C.sun : C.bad} lineWidth={sunClear ? 1.8 : 1.5} dashed={!sunClear} dashSize={0.045} gapSize={0.035} />
      <Line ref={earthLine} points={O} color={earthClear ? C.earth : C.bad} lineWidth={earthClear ? 1.8 : 1.5} dashed={!earthClear} dashSize={0.045} gapSize={0.035} />

      <group ref={sunEnd}>
        <ScreenScale k={0.012}>
          <mesh>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color={C.sun} />
          </mesh>
        </ScreenScale>
        <Html zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`los-label${sunClear ? '' : ' off'}`} style={{ color: C.sun }}>Sun</div>
        </Html>
      </group>
      {/* Earth is drawn in the right direction but much closer and larger than reality. */}
      <group ref={earthEnd}>
        <mesh>
          <sphereGeometry args={[0.06, 32, 32]} />
          <meshStandardMaterial color={C.earth} roughness={0.9} />
        </mesh>
        <Html zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`los-label${earthClear ? '' : ' off'}`} style={{ color: C.earth }}>Earth</div>
        </Html>
      </group>
      <group ref={sunMid}>
        <Html zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`los-label blocked${sunClear ? ' off' : ''}`}>Sun blocked by terrain</div>
        </Html>
      </group>
      <group ref={earthMid}>
        <Html zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`los-label blocked${earthClear ? ' off' : ''}`}>Earth blocked by terrain</div>
        </Html>
      </group>
      </group>
      )}
    </>
  )
}

/** Where the camera should sit to look at a site: above it, tilted off the polar axis so orbiting stays stable. */
function cameraSpot(lat: number, lon: number, dist: number) {
  const up = v3(sitePosition(lat, lon))
  const out = v3(sitePosition(0, lon))
  return up.addScaledVector(out, 0.3).normalize().multiplyScalar(dist)
}

const OPENING_DISTANCE = 4.7

function CameraRig({ recentre }: { recentre: number }) {
  const site = useStore((s) => s.site)
  const intro = useStore((s) => s.intro)
  const { camera, invalidate } = useThree()
  const target = useRef<THREE.Vector3 | null>(null)
  const first = useRef(true)
  const wasIntro = useRef(intro)

  useEffect(() => {
    const s = siteById(site)
    if (useStore.getState().intro) {
      // The intro owns the camera. Choosing another site mid-intro ends it and glides there.
      if (!first.current) useStore.getState().finishIntro()
      first.current = false
      return
    }
    const dist = first.current ? OPENING_DISTANCE : THREE.MathUtils.clamp(camera.position.length(), 1.6, 5.5)
    const spot = cameraSpot(s.lat, s.lon, dist)
    if (reducedMotion()) {
      camera.position.copy(spot)
      camera.lookAt(0, 0, 0)
      target.current = null
    } else {
      // Opening move without an intro: start a little further out and settle in.
      if (first.current) camera.position.copy(spot).multiplyScalar(1.22)
      target.current = spot
    }
    first.current = false
    invalidate()
  }, [site, recentre, camera, invalidate])

  // Intro over (finished or skipped): glide to the opening view. If it finished, we are already there.
  useEffect(() => {
    if (wasIntro.current && !intro) {
      const s = siteById(useStore.getState().site)
      const spot = cameraSpot(s.lat, s.lon, OPENING_DISTANCE)
      if (reducedMotion()) camera.position.copy(spot)
      camera.up.set(0, 1, 0)
      camera.lookAt(0, 0, 0)
      target.current = camera.position.distanceTo(spot) > 0.01 ? spot : null
      invalidate()
    }
    wasIntro.current = intro
  }, [intro, camera, invalidate])

  useFrame((_, dt) => {
    const to = target.current
    if (!to || useStore.getState().intro) return
    const k = 1 - Math.exp(-Math.min(dt, 1 / 30) * 3.2)
    const len = THREE.MathUtils.lerp(camera.position.length(), to.length(), k)
    camera.position.lerp(to, k).setLength(len)
    camera.lookAt(0, 0, 0)
    if (camera.position.distanceTo(to) < 0.003) target.current = null
    invalidate()
  })

  return (
    <OrbitControls
      enabled={!intro}
      enablePan={false}
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={0.5}
      zoomSpeed={0.7}
      minDistance={1.12}
      maxDistance={8}
      minPolarAngle={0.06}
      maxPolarAngle={Math.PI - 0.06}
      onStart={() => (target.current = null)}
    />
  )
}

/** Mounted only while the intro plays; it drives the shared camera to the explorer's opening view. */
function Intro({ moonReady }: { moonReady: boolean }) {
  const intro = useStore((s) => s.intro)
  const finalSpot = useMemo(() => {
    const s = siteById(useStore.getState().site)
    return cameraSpot(s.lat, s.lon, OPENING_DISTANCE)
    // Re-staged each time the intro (re)starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro])
  return intro ? <IntroDirector moonReady={moonReady} finalSpot={finalSpot} /> : null
}

export default function MoonScene({ recentre, onReady }: { recentre: number; onReady: () => void }) {
  const revealed = useStore((s) => s.revealed)
  const [moonReady, setMoonReady] = useState(false)
  const ready = useCallback(() => {
    setMoonReady(true)
    onReady()
  }, [onReady])
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 32, near: 0.01, far: 100, position: [0, -5.7, 0.01] }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => gl.setClearColor('#000000')}
      aria-label="3D Moon with site pins and Sun and Earth sight lines"
      role="img"
    >
      {/* The Moon loads in its own boundary so the intro can start at Earth straight away. */}
      <Suspense fallback={null}>
        <Moon onReady={ready} />
      </Suspense>
      {/* Pins mount once the Moon is in; their labels did not attach reliably when mounted on the very first frame. */}
      {moonReady && (
        <group visible={revealed}>
          <Pins />
        </group>
      )}
      <Sky mounted={moonReady} />
      <CameraRig recentre={recentre} />
      <Intro moonReady={moonReady} />
    </Canvas>
  )
}
