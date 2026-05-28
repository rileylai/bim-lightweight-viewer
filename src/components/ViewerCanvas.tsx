import { useCallback, useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { OrthographicCamera, PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { fitCameraToObject } from '../lib/fitCameraToObject'
import { bindIfcRuntimeCamera, probeIfcRuntimeSelection, updateIfcRuntimeView } from '../lib/ifcLoaderRuntime'
import type { IfcRaycastProbeResult, IfcRuntimeModel } from '../types/ifc'

interface ViewerCanvasProps {
  orbitEnabled?: boolean
  ifcModel: IfcRuntimeModel | null
  onIfcProbe: (result: IfcRaycastProbeResult) => void
}

interface IfcRuntimeBridgeProps {
  ifcModel: IfcRuntimeModel | null
}

interface CameraFitBridgeProps {
  ifcModel: IfcRuntimeModel | null
  orbitControlsRef: RefObject<OrbitControlsImpl | null>
}

interface IfcProbeBridgeProps {
  ifcModel: IfcRuntimeModel | null
  onIfcProbe: (result: IfcRaycastProbeResult) => void
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

    void updateIfcRuntimeView()
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

function IfcProbeBridge({ ifcModel, onIfcProbe }: IfcProbeBridgeProps) {
  const { camera, gl } = useThree()

  const runProbeFromPointer = useCallback(
    (event: PointerEvent) => {
      if (!ifcModel || event.button !== 0) {
        return
      }

      const canvas = gl.domElement
      const rect = canvas.getBoundingClientRect()
      const canvasX = event.clientX - rect.left
      const canvasY = event.clientY - rect.top
      const pointerInsideRect = canvasX >= 0 && canvasY >= 0 && canvasX <= rect.width && canvasY <= rect.height
      const ndcX = rect.width > 0 ? (canvasX / rect.width) * 2 - 1 : Number.NaN
      const ndcY = rect.height > 0 ? -(canvasY / rect.height) * 2 + 1 : Number.NaN

      const scaleX = canvas.clientWidth > 0 ? rect.width / canvas.clientWidth : Number.NaN
      const scaleY = canvas.clientHeight > 0 ? rect.height / canvas.clientHeight : Number.NaN
      const pixelSpaceX = Number.isFinite(scaleX) ? canvasX / scaleX : Number.NaN
      const pixelSpaceY = Number.isFinite(scaleY) ? canvasY / scaleY : Number.NaN
      const ndcByCanvasClientX =
        canvas.clientWidth > 0 ? (pixelSpaceX / canvas.clientWidth) * 2 - 1 : Number.NaN
      const ndcByCanvasClientY =
        canvas.clientHeight > 0 ? -(pixelSpaceY / canvas.clientHeight) * 2 + 1 : Number.NaN

      // Step 8 診斷：確認 click 座標、canvas rect、NDC 與 camera 參數是否一致，排查命中偏移來源。
      console.log('[IfcProbeDebug] pointerdown', {
        modelId: ifcModel.modelId,
        browserClientX: event.clientX,
        browserClientY: event.clientY,
        canvasRelativeX: Number(canvasX.toFixed(3)),
        canvasRelativeY: Number(canvasY.toFixed(3)),
        pointerInsideRect,
        rect: {
          left: Number(rect.left.toFixed(3)),
          top: Number(rect.top.toFixed(3)),
          width: Number(rect.width.toFixed(3)),
          height: Number(rect.height.toFixed(3)),
        },
        canvasSize: {
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          width: canvas.width,
          height: canvas.height,
        },
        ndcFromRect: {
          x: Number(ndcX.toFixed(4)),
          y: Number(ndcY.toFixed(4)),
        },
        ndcFromCanvasClient: {
          x: Number(ndcByCanvasClientX.toFixed(4)),
          y: Number(ndcByCanvasClientY.toFixed(4)),
        },
        camera: {
          uuid: camera.uuid,
          type: camera.type,
          position: {
            x: Number(camera.position.x.toFixed(4)),
            y: Number(camera.position.y.toFixed(4)),
            z: Number(camera.position.z.toFixed(4)),
          },
          rotation: {
            x: Number(camera.rotation.x.toFixed(4)),
            y: Number(camera.rotation.y.toFixed(4)),
            z: Number(camera.rotation.z.toFixed(4)),
          },
          near: 'near' in camera ? Number(camera.near.toFixed(4)) : null,
          far: 'far' in camera ? Number(camera.far.toFixed(4)) : null,
        },
        raycastPayloadMouse: {
          x: Number(event.clientX.toFixed(3)),
          y: Number(event.clientY.toFixed(3)),
          space: 'browser-client-coordinate',
        },
      })

      if (!pointerInsideRect) {
        return
      }

      // Step 8 補強：點擊時再次綁定目前 camera，避免 runtime 使用過期相機狀態。
      bindIfcRuntimeCamera(camera as PerspectiveCamera | OrthographicCamera)

      // Step 8 探針：避免 R3F 物件事件預設 raycast，改用 DOM pointer 並傳 browser client 座標給 fragments raycast。
      void probeIfcRuntimeSelection({
        camera: camera as PerspectiveCamera | OrthographicCamera,
        dom: canvas,
        clientX: event.clientX,
        clientY: event.clientY,
      }).then(onIfcProbe)
    },
    [camera, gl, ifcModel, onIfcProbe],
  )

  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('pointerdown', runProbeFromPointer)

    return () => {
      canvas.removeEventListener('pointerdown', runProbeFromPointer)
    }
  }, [gl, runProbeFromPointer])

  return null
}

function ViewerCanvas({ orbitEnabled = true, ifcModel, onIfcProbe }: ViewerCanvasProps) {
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
      <IfcProbeBridge ifcModel={ifcModel} onIfcProbe={onIfcProbe} />

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
