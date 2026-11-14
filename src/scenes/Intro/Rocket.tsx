import { forwardRef } from 'react'
import type { Group } from 'three'

/**
 * An original low-poly rocket built from primitives: no logos, no imported model.
 * Its nose points along +Y; one unit is the rocket's length.
 */
const Rocket = forwardRef<Group>(function Rocket(_, ref) {
  return (
    <group ref={ref}>
      {/* body */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.085, 0.1, 0.62, 10]} />
        <meshStandardMaterial color="#e9e6df" emissive="#e9e6df" emissiveIntensity={0.22} roughness={0.6} flatShading />
      </mesh>
      {/* nose */}
      <mesh position={[0, 0.44, 0]}>
        <coneGeometry args={[0.085, 0.24, 10]} />
        <meshStandardMaterial color="#c9c4ba" emissive="#c9c4ba" emissiveIntensity={0.22} roughness={0.6} flatShading />
      </mesh>
      {/* band */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.088, 0.09, 0.05, 10]} />
        <meshStandardMaterial color="#55524c" roughness={0.8} flatShading />
      </mesh>
      {/* fins */}
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <mesh position={[0.13, -0.24, 0]} rotation={[0, 0, -0.35]}>
            <boxGeometry args={[0.12, 0.2, 0.014]} />
            <meshStandardMaterial color="#8d8982" emissive="#8d8982" emissiveIntensity={0.22} roughness={0.7} flatShading />
          </mesh>
        </group>
      ))}
      {/* The hull glows faintly so it reads against the night side; the exhaust is unlit and bright. */}
      <mesh position={[0, -0.33, 0]}>
        <cylinderGeometry args={[0.05, 0.075, 0.08, 10]} />
        <meshStandardMaterial color="#3c3a36" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, -0.62, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.06, 0.5, 10]} />
        <meshBasicMaterial color="#ffd89a" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.1, 0.34, 10]} />
        <meshBasicMaterial color="#ff9d4d" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  )
})
export default Rocket
