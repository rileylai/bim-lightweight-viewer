import { useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { fitCameraToObject } from '../lib/fitCameraToObject'
import { bindIfcRuntimeCamera, updateIfcRuntimeView } from '../lib/ifcLoaderRuntime'
import type { IfcRuntimeModel } from '../types/ifc'

interface ViewerCanvasProps {
  orbitEnabled?: boolean
  ifcModel: IfcRuntimeModel | null
}

interface IfcRuntimeBridgeProps {
  ifcModel: IfcRuntimeModel | null
}

interface CameraFitBridgeProps {
  ifcModel: IfcRuntimeModel | null
  orbitControlsRef: RefObject<OrbitControlsImpl | null>
}

function IfcRuntimeBridge({ ifcModel }: IfcRuntimeBridgeProps) {
  const { camera } = useThree()

  useEffect(() => {
    if (!ifcModel) {
      return
    }

    // 將目前 R3F 相機同步到 IFC fragments runtime，讓載入後模型能依視角更新可見性。
    bindIfcRuntimeCamera(camera)
  }, [camera, ifcModel])

  useFrame(() => {
    if (!ifcModel) {
      return
    }

    updateIfcRuntimeView()
  })

  return null
}

function CameraFitBridge({ ifcModel, orbitControlsRef }: CameraFitBridgeProps) {
  const { camera, size } = useThree()

  useEffect(() => {
    if (!ifcModel || !ifcModel.object || size.width <= 0 || size.height <= 0) {
      return
    }

    const runFit = (trigger: 'raf' | 'timeout-100ms' | 'timeout-300ms') => {
      const fitApplied = fitCameraToObject(camera, ifcModel.object, {
        controls: orbitControlsRef.current,
      })

      if (!fitApplied) {
        console.warn('[CameraFit] fit failed', {
          trigger,
          modelId: ifcModel.modelId,
        })
      }
    }

    const frameId = window.requestAnimationFrame(() => {
      runFit('raf')
    })
    const timeout100 = window.setTimeout(() => runFit('timeout-100ms'), 100)
    const timeout300 = window.setTimeout(() => runFit('timeout-300ms'), 300)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeout100)
      window.clearTimeout(timeout300)
    }
  }, [camera, ifcModel, orbitControlsRef, size])

  return null
}

function ViewerCanvas({ orbitEnabled = true, ifcModel }: ViewerCanvasProps) {
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null)

  return (
    <Canvas camera={{ position: [5.4, 3.8, 5.4], fov: 50, near: 0.1, far: 120 }}>
      {/* Step 3 補上可互動的 OrbitControls，並保留 enabled 入口給後續 TransformControls 停用控制。 */}
      <OrbitControls
        makeDefault
        ref={orbitControlsRef}
        enabled={orbitEnabled}
        target={[0, 0.2, 0]}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.72}
        panSpeed={0.88}
        zoomSpeed={0.9}
        minDistance={0.25}
        maxDistance={5000}
      />

      <color attach="background" args={["#ecf2f8"]} />
      <ambientLight intensity={0.66} />
      <hemisphereLight intensity={0.42} groundColor="#d9e7f2" color="#f6fbff" />
      <directionalLight intensity={0.85} position={[8, 10, 6]} />
      <gridHelper args={[20, 20, '#9cb2c4', '#c8d8e4']} position={[0, -0.6, 0]} />
      <axesHelper args={[2]} />

      <IfcRuntimeBridge ifcModel={ifcModel} />
      <CameraFitBridge ifcModel={ifcModel} orbitControlsRef={orbitControlsRef} />

      {ifcModel ? (
        <primitive object={ifcModel.object} />
      ) : (
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[1.4, 1.4, 1.4]} />
          <meshStandardMaterial color="#4d85ab" roughness={0.6} metalness={0.1} />
        </mesh>
      )}

      <mesh position={[0, -0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#f7fbff" />
      </mesh>
    </Canvas>
  )
}

export default ViewerCanvas
