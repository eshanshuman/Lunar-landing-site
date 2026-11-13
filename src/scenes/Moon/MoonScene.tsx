/**
 * Scene 1: the 3D Moon explorer (PLAN.md §3, milestone M2).
 * The Sun light, the Earth marker and both sight lines come from the selected site's
 * Sun / Earth azimuth and elevation at the store's time.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { dataset, siteById } from '../../data/dataset'
import { C } from '../../lib/theme'
import { earthVisible, sunVisible } from '../../lib/visibility'
import { useStore } from '../../state/store'
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

function Moon() {
  const [color, ldem] = useTexture([`${BASE}textures/moon_color_4k.jpg`, `${BASE}textures/moon_ldem_4.png`])
  const gl = useThree((s) => s.gl)
  useMemo(() => {
    color.colorSpace = THREE.SRGBColorSpace
    color.anisotropy = gl.capabilities.getMaxAnisotropy()
  }, [color, gl])
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
function ScreenScale({ position, k = 0.011, children }: { position: THREE.Vector3; k?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ camera }) => ref.current?.scale.setScalar(camera.position.distanceTo(position) * k))
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  )
}

function Pins() {
  const site = useStore((s) => s.site)
  const selectSite = useStore((s) => s.selectSite)
  const [hover, setHover] = useState<string | null>(null)
  const { gl } = useThree()

  return (
    <>
      {dataset.sites.map((s) => {
        const up = v3(sitePosition(s.lat, s.lon))
        const pos = up.clone().multiplyScalar(LIFT)
        const on = s.id === site
        const facing = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up)
        return (
          <ScreenScale key={s.id} position={pos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation()
                selectSite(s.id)
              }}
              onPointerOver={(e) => {
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
            <mesh>
              <sphereGeometry args={[on ? 0.5 : 0.36, 16, 16]} />
              <meshBasicMaterial color={on ? C.text : '#bdb9b1'} />
            </mesh>
            {on && (
              <mesh quaternion={facing}>
                <ringGeometry args={[1.2, 1.36, 48]} />
                <meshBasicMaterial color={C.text} side={THREE.DoubleSide} />
              </mesh>
            )}
            {(on || hover === s.id) && (
              <Html position={[0, 0, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                <div className={`pin-label${on ? ' on' : ''}`}>{s.name}</div>
              </Html>
            )}
          </ScreenScale>
        )
      })}
    </>
  )
}

function SightLine({ from, to, colour, clear, label }: { from: THREE.Vector3; to: THREE.Vector3; colour: string; clear: boolean; label: string }) {
  const mid = from.clone().lerp(to, 0.5)
  return (
    <>
      <Line
        points={[from, to]}
        color={clear ? colour : C.bad}
        lineWidth={clear ? 1.8 : 1.5}
        dashed={!clear}
        dashSize={0.045}
        gapSize={0.035}
      />
      <Html position={clear ? to : mid} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`los-label${clear ? '' : ' blocked'}`} style={clear ? { color: colour } : undefined}>
          {clear ? label : `${label} blocked by terrain`}
        </div>
      </Html>
    </>
  )
}

/** Sun light, Earth marker and the two sight lines for the selected site and time. */
function Sky() {
  const site = useStore((s) => s.site)
  const landingDay = useStore((s) => s.landingDay)
  const t = useStore((s) => s.t)
  const s = siteById(site)
  const d = dataset.bySite[site]
  const i = Math.min(landingDay * 24 + t, d.sun.el.length - 1)

  const from = v3(sitePosition(s.lat, s.lon)).multiplyScalar(LIFT)
  const sunDir = v3(skyDirection(s.lat, s.lon, d.sun.az[i], d.sun.el[i]))
  const earthDir = v3(skyDirection(s.lat, s.lon, d.earth.az[i], d.earth.el[i]))
  const sunEnd = from.clone().addScaledVector(sunDir, SIGHT)
  const earthEnd = from.clone().addScaledVector(earthDir, SIGHT)

  return (
    <>
      <ambientLight intensity={0.035} />
      <directionalLight position={sunDir.clone().multiplyScalar(50)} intensity={3.4} />
      <SightLine from={from} to={sunEnd} colour={C.sun} clear={sunVisible(d, i)} label="Sun" />
      <SightLine from={from} to={earthEnd} colour={C.earth} clear={earthVisible(d, i)} label="Earth" />
      <ScreenScale position={sunEnd} k={0.012}>
        <mesh>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={C.sun} />
        </mesh>
      </ScreenScale>
      {/* Earth is drawn in the right direction but much closer and larger than reality. */}
      <mesh position={earthEnd}>
        <sphereGeometry args={[0.06, 32, 32]} />
        <meshStandardMaterial color={C.earth} roughness={0.9} />
      </mesh>
    </>
  )
}

/** Where the camera should sit to look at a site: above it, tilted off the polar axis so orbiting stays stable. */
function cameraSpot(lat: number, lon: number, dist: number) {
  const up = v3(sitePosition(lat, lon))
  const out = v3(sitePosition(0, lon))
  return up.addScaledVector(out, 0.3).normalize().multiplyScalar(dist)
}

function CameraRig({ recentre }: { recentre: number }) {
  const site = useStore((s) => s.site)
  const { camera, invalidate } = useThree()
  const target = useRef<THREE.Vector3 | null>(null)
  const first = useRef(true)

  useEffect(() => {
    const s = siteById(site)
    const dist = first.current ? 4.7 : THREE.MathUtils.clamp(camera.position.length(), 1.6, 5.5)
    const spot = cameraSpot(s.lat, s.lon, dist)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (first.current || reduce) {
      camera.position.copy(spot)
      camera.lookAt(0, 0, 0)
      target.current = null
    } else target.current = spot
    first.current = false
    invalidate()
  }, [site, recentre, camera, invalidate])

  useFrame((_, dt) => {
    const to = target.current
    if (!to) return
    const k = 1 - Math.exp(-dt * 5)
    const len = THREE.MathUtils.lerp(camera.position.length(), to.length(), k)
    camera.position.lerp(to, k).setLength(len)
    camera.lookAt(0, 0, 0)
    if (camera.position.distanceTo(to) < 0.004) target.current = null
    invalidate()
  })

  return (
    <OrbitControls
      enablePan={false}
      enableDamping
      dampingFactor={0.12}
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

export default function MoonScene({ recentre }: { recentre: number }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 32, near: 0.01, far: 100, position: [0, -4.7, 0.01] }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => gl.setClearColor('#000000')}
      aria-label="3D Moon with site pins and Sun and Earth sight lines"
      role="img"
    >
      <Moon />
      <Pins />
      <Sky />
      <CameraRig recentre={recentre} />
    </Canvas>
  )
}
