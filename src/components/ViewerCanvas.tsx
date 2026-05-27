import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

interface ViewerCanvasProps {
  orbitEnabled?: boolean
}

function ViewerCanvas({ orbitEnabled = true }: ViewerCanvasProps) {
  return (
    <Canvas camera={{ position: [5.4, 3.8, 5.4], fov: 50, near: 0.1, far: 120 }}>
      {/* Step 3 補上可互動的 OrbitControls，並保留 enabled 入口給後續 TransformControls 停用控制。 */}
      <OrbitControls
        makeDefault
        enabled={orbitEnabled}
        target={[0, 0.2, 0]}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.72}
        panSpeed={0.88}
        zoomSpeed={0.9}
        minDistance={2}
        maxDistance={32}
      />

      <color attach="background" args={["#ecf2f8"]} />
      <ambientLight intensity={0.66} />
      <hemisphereLight intensity={0.42} groundColor="#d9e7f2" color="#f6fbff" />
      <directionalLight intensity={0.85} position={[8, 10, 6]} />
      <gridHelper args={[20, 20, '#9cb2c4', '#c8d8e4']} position={[0, -0.6, 0]} />
      <axesHelper args={[2]} />

      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
        <meshStandardMaterial color="#4d85ab" roughness={0.6} metalness={0.1} />
      </mesh>

      <mesh position={[0, -0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#f7fbff" />
      </mesh>
    </Canvas>
  )
}

export default ViewerCanvas
