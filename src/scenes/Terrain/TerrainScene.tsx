/**
 * The 3D shadow view: a 20 km square of real LOLA terrain around the site, lit from the Sun's
 * direction at the store's time, with shadow mapping. Scene units are kilometres.
 * X is tile right, Z is tile down (so tile "up" is -Z), Y is height.
 *
 * Every vertex is lowered by d^2 / 2R (the Moon curving away from the site), the same drop the
 * line-of-sight test in lib/terrainShadow uses, so the drawn shadows and that test agree.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { curvatureDrop, heightAt, tileDirection, type Tile } from '../../lib/terrainShadow'
import { C } from '../../lib/theme'

const D2R = Math.PI / 180
const LINE_KM = 6

export interface Sky {
  sunAz: number
  sunEl: number
  earthAz: number
  earthEl: number
  /** From the 150 km horizon mask (lib/visibility), not from this tile. */
  sunClear: boolean
  earthClear: boolean
}

/** Scene-space unit vector towards a body at (az clockwise from true north, el). */
function skyVector(tile: Tile, az: number, el: number, out = new THREE.Vector3()) {
  const [dx, dy] = tileDirection(tile.meta, az)
  const c = Math.cos(el * D2R)
  return out.set(dx * c, Math.sin(el * D2R), -dy * c)
}

function Ground({ tile, exaggeration }: { tile: Tile; exaggeration: number }) {
  const { px, size_m, sphere_r_m } = tile.meta
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(px * px * 3), 3))
    const idx = new Uint32Array((px - 1) * (px - 1) * 6)
    let k = 0
    for (let i = 0; i < px - 1; i++)
      for (let j = 0; j < px - 1; j++) {
        const a = i * px + j
        idx.set([a, a + px, a + 1, a + 1, a + px, a + px + 1], k)
        k += 6
      }
    g.setIndex(new THREE.BufferAttribute(idx, 1))
    return g
  }, [px])

  useLayoutEffect(() => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const cell = size_m / px
    const h0 = heightAt(tile, 0, 0) ?? 0
    for (let i = 0; i < px; i++)
      for (let j = 0; j < px; j++) {
        const x = (j + 0.5) * cell - size_m / 2
        const y = size_m / 2 - (i + 0.5) * cell
        const up = (tile.heights[i * px + j] - h0) * exaggeration - curvatureDrop(Math.hypot(x, y), sphere_r_m)
        pos.setXYZ(i * px + j, x / 1000, up / 1000, -y / 1000)
      }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingBox()
    geo.computeBoundingSphere()
  }, [geo, tile, exaggeration, px, size_m, sphere_r_m])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color="#b3aea4" roughness={1} metalness={0} />
    </mesh>
  )
}

/** The Sun: a directional light whose shadow camera is fitted to the terrain every time it moves. */
function Sun({ tile, sky, exaggeration }: { tile: Tile; sky: Sky; exaggeration: number }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const invalidate = useThree((s) => s.invalidate)
  const half = tile.meta.size_m / 2000
  // Height range of the mesh in km, generous enough for any exaggeration.
  const [yMin, yMax] = useMemo(() => {
    const h0 = heightAt(tile, 0, 0) ?? 0
    const drop = curvatureDrop(half * 1000 * Math.SQRT2, tile.meta.sphere_r_m)
    return [((tile.meta.h_min_m - h0) * exaggeration - drop) / 1000 - 0.05, ((tile.meta.h_max_m - h0) * exaggeration) / 1000 + 0.05]
  }, [tile, exaggeration, half])

  useLayoutEffect(() => {
    const l = light.current
    if (!l) return
    const dir = skyVector(tile, sky.sunAz, sky.sunEl)
    const D = 80
    l.position.copy(dir).multiplyScalar(D)
    l.target.position.set(0, 0, 0)
    l.target.updateMatrixWorld()
    // Light-space axes, the same ones three.js derives from position -> target with up = +Y.
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize()
    const up = new THREE.Vector3().crossVectors(dir, right)
    let l0 = Infinity, r0 = -Infinity, b0 = Infinity, t0 = -Infinity, n0 = Infinity, f0 = -Infinity
    const c = new THREE.Vector3()
    for (const x of [-half, half])
      for (const y of [yMin, yMax])
        for (const z of [-half, half]) {
          c.set(x, y, z)
          const u = c.dot(right), v = c.dot(up), w = D - c.dot(dir)
          l0 = Math.min(l0, u); r0 = Math.max(r0, u)
          b0 = Math.min(b0, v); t0 = Math.max(t0, v)
          n0 = Math.min(n0, w); f0 = Math.max(f0, w)
        }
    const cam = l.shadow.camera
    cam.left = l0; cam.right = r0; cam.bottom = b0; cam.top = t0
    cam.near = Math.max(0.1, n0 - 1); cam.far = f0 + 1
    cam.updateProjectionMatrix()
    l.shadow.needsUpdate = true
    invalidate()
  }, [tile, sky.sunAz, sky.sunEl, half, yMin, yMax, invalidate])

  return (
    <directionalLight
      ref={light}
      intensity={3.2}
      castShadow
      shadow-mapSize={[4096, 4096]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.012}
    />
  )
}

/** Keeps its children the same size on screen whatever the zoom. */
function ScreenScale({ k, children }: { k: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const world = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const g = ref.current
    if (g) g.scale.setScalar(camera.position.distanceTo(g.getWorldPosition(world)) * k)
  })
  return <group ref={ref}>{children}</group>
}

/** Lander marker at the tile centre with its lines to the Sun and Earth. */
function Lander({ tile, sky }: { tile: Tile; sky: Sky }) {
  const base = useMemo(() => new THREE.Vector3(0, 0.03, 0), [])
  const sunEnd = skyVector(tile, sky.sunAz, sky.sunEl).multiplyScalar(LINE_KM).add(base)
  const earthEnd = skyVector(tile, sky.earthAz, sky.earthEl).multiplyScalar(LINE_KM).add(base)
  const line = (end: THREE.Vector3, colour: string, clear: boolean) => (
    <Line
      points={[base, end]}
      color={clear ? colour : C.bad}
      lineWidth={clear ? 2.2 : 1.8}
      dashed={!clear}
      dashSize={0.22}
      gapSize={0.16}
      depthTest={false}
      renderOrder={2}
    />
  )
  return (
    <>
      {line(sunEnd, C.sun, sky.sunClear)}
      {line(earthEnd, C.earth, sky.earthClear)}
      <group position={base}>
        <ScreenScale k={0.011}>
          <mesh renderOrder={3}>
            <sphereGeometry args={[0.55, 16, 16]} />
            <meshBasicMaterial color={C.text} depthTest={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
            <ringGeometry args={[1.25, 1.42, 48]} />
            <meshBasicMaterial color={C.text} side={THREE.DoubleSide} depthTest={false} />
          </mesh>
        </ScreenScale>
      </group>
      <group position={sunEnd}>
        <ScreenScale k={0.012}>
          <mesh>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color={sky.sunClear ? C.sun : C.bad} />
          </mesh>
        </ScreenScale>
      </group>
      <group position={earthEnd}>
        <ScreenScale k={0.012}>
          <mesh>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color={sky.earthClear ? C.earth : C.bad} />
          </mesh>
        </ScreenScale>
      </group>
    </>
  )
}

/** A small arrow on the tile's edge pointing to true north. */
function NorthArrow({ tile }: { tile: Tile }) {
  const [dx, dy] = tileDirection(tile.meta, 0)
  const r = tile.meta.size_m / 2000 + 1.1
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, -dy)), [dx, dy])
  return (
    <mesh position={[dx * r, 0, -dy * r]} quaternion={q}>
      <coneGeometry args={[0.32, 1.1, 3]} />
      <meshBasicMaterial color={C.muted} />
    </mesh>
  )
}

export default function TerrainScene({ tile, sky, exaggeration }: { tile: Tile; sky: Sky; exaggeration: number }) {
  return (
    <Canvas
      shadows="soft"
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ fov: 30, near: 0.05, far: 400, position: [-11, 17, 34] }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => gl.setClearColor('#000000')}
      role="img"
      aria-label="3D terrain around the site with Sun shadows and lines to the Sun and Earth"
    >
      <ambientLight intensity={0.05} />
      <Sun tile={tile} sky={sky} exaggeration={exaggeration} />
      <Ground tile={tile} exaggeration={exaggeration} />
      <Lander tile={tile} sky={sky} />
      <NorthArrow tile={tile} />
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.1} minDistance={3} maxDistance={60} maxPolarAngle={Math.PI / 2 - 0.03} />
    </Canvas>
  )
}
