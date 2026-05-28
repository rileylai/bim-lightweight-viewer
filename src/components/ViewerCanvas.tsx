import { useCallback, useEffect, useMemo, useRef } from 'react'
import { OrbitControls, TransformControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Object3D, OrthographicCamera, PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl, TransformControls as TransformControlsImpl } from 'three-stdlib'
import { fitCameraToObject } from '../lib/fitCameraToObject'
import { bindIfcRuntimeCamera, probeIfcRuntimeSelection, updateIfcRuntimeView } from '../lib/ifcLoaderRuntime'
import type { IfcRaycastProbeResult, IfcRuntimeModel } from '../types/ifc'
import { toSceneObjectReference } from '../lib/sceneObjectIdentity'
import type {
  SceneObjectIdentity,
  SceneObjectTransformMode,
  SceneObjectTransformSnapshot,
} from '../types/sceneObjectIdentity'

interface ViewerCanvasProps {
  orbitEnabled?: boolean
  ifcModel: IfcRuntimeModel | null
  selectedObject: SceneObjectIdentity | null
  transformMode: SceneObjectTransformMode
  onIfcProbe: (result: IfcRaycastProbeResult) => void
  onTransformModeChange: (mode: SceneObjectTransformMode) => void
  onTransformDraggingChange: (isDragging: boolean) => void
  onTransformSnapshotChange: (snapshot: SceneObjectTransformSnapshot | null) => void
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
  transformControlsRef: RefObject<TransformControlsImpl | null>
}

interface TransformControlsBridgeProps {
  ifcModel: IfcRuntimeModel | null
  selectedObject: SceneObjectIdentity | null
  transformMode: SceneObjectTransformMode
  transformControlsRef: RefObject<TransformControlsImpl | null>
  onTransformModeChange: (mode: SceneObjectTransformMode) => void
  onTransformDraggingChange: (isDragging: boolean) => void
  onTransformSnapshotChange: (snapshot: SceneObjectTransformSnapshot | null) => void
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
  const fittedModelIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!ifcModel) {
      // 當前場景沒有 IFC model 時重置 fit 記錄，避免下次載入新模型被誤判為已完成。
      fittedModelIdRef.current = null
    }
  }, [ifcModel])

  useEffect(() => {
    if (!ifcModel || !ifcModel.object || size.width <= 0 || size.height <= 0) {
      return
    }

    if (fittedModelIdRef.current === ifcModel.modelId) {
      return
    }

    let timeout100Id: number | null = null
    let timeout300Id: number | null = null

    const clearDelayedFits = () => {
      if (timeout100Id !== null) {
        window.clearTimeout(timeout100Id)
        timeout100Id = null
      }

      if (timeout300Id !== null) {
        window.clearTimeout(timeout300Id)
        timeout300Id = null
      }
    }

    const runFit = (trigger: 'raf' | 'timeout-100ms' | 'timeout-300ms') => {
      if (fittedModelIdRef.current === ifcModel.modelId) {
        return true
      }

      const fitApplied = fitCameraToObject(camera, ifcModel.object, {
        controls: orbitControlsRef.current,
      })

      if (fitApplied) {
        fittedModelIdRef.current = ifcModel.modelId
        return true
      }

      if (!fitApplied) {
        console.warn('[CameraFit] fit failed', {
          trigger,
          modelId: ifcModel.modelId,
        })
      }

      return false
    }

    const frameId = window.requestAnimationFrame(() => {
      const rafFitApplied = runFit('raf')
      if (rafFitApplied) {
        clearDelayedFits()
      }
    })
    timeout100Id = window.setTimeout(() => {
      const timeout100FitApplied = runFit('timeout-100ms')
      if (timeout100FitApplied && timeout300Id !== null) {
        window.clearTimeout(timeout300Id)
        timeout300Id = null
      }
    }, 100)
    timeout300Id = window.setTimeout(() => {
      runFit('timeout-300ms')
    }, 300)

    return () => {
      window.cancelAnimationFrame(frameId)
      clearDelayedFits()
    }
  }, [camera, ifcModel, orbitControlsRef, size])

  return null
}

const createTransformSnapshot = (
  selectedObject: SceneObjectIdentity,
  targetObject: Object3D,
): SceneObjectTransformSnapshot => ({
  objectRef: toSceneObjectReference(selectedObject),
  position: [targetObject.position.x, targetObject.position.y, targetObject.position.z],
  rotation: [targetObject.rotation.x, targetObject.rotation.y, targetObject.rotation.z],
  scale: [targetObject.scale.x, targetObject.scale.y, targetObject.scale.z],
})

function TransformControlsBridge({
  ifcModel,
  selectedObject,
  transformMode,
  transformControlsRef,
  onTransformModeChange,
  onTransformDraggingChange,
  onTransformSnapshotChange,
}: TransformControlsBridgeProps) {
  const transformTarget = useMemo(() => {
    if (!ifcModel || !selectedObject || selectedObject.sourceType !== 'ifc') {
      return null
    }

    if (selectedObject.sourceId !== ifcModel.modelId) {
      return null
    }

    return ifcModel.object
  }, [ifcModel, selectedObject])

  const emitTransformSnapshot = useCallback(() => {
    if (!selectedObject || !transformTarget) {
      return
    }

    // Step 10：TransformControls 只更新可序列化的 position/rotation/scale，不在 state 存放 Three runtime reference。
    onTransformSnapshotChange(createTransformSnapshot(selectedObject, transformTarget))
  }, [onTransformSnapshotChange, selectedObject, transformTarget])

  const handleTransformMouseDown = useCallback(() => {
    onTransformDraggingChange(true)
  }, [onTransformDraggingChange])

  const handleTransformMouseUp = useCallback(() => {
    onTransformDraggingChange(false)
    emitTransformSnapshot()
  }, [emitTransformSnapshot, onTransformDraggingChange])

  useEffect(() => {
    if (!transformTarget || !selectedObject) {
      onTransformDraggingChange(false)
      onTransformSnapshotChange(null)
      return
    }

    emitTransformSnapshot()
  }, [emitTransformSnapshot, onTransformDraggingChange, onTransformSnapshotChange, selectedObject, transformTarget])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }

      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable) {
          return
        }
      }

      const key = event.key.toLowerCase()
      if (key === 'w') {
        event.preventDefault()
        onTransformModeChange('translate')
        return
      }

      if (key === 'e') {
        event.preventDefault()
        onTransformModeChange('rotate')
        return
      }

      if (key === 'r') {
        event.preventDefault()
        onTransformModeChange('scale')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onTransformModeChange])

  if (!transformTarget || !selectedObject) {
    return null
  }

  return (
    <TransformControls
      ref={transformControlsRef}
      object={transformTarget}
      mode={transformMode}
      onMouseDown={handleTransformMouseDown}
      onMouseUp={handleTransformMouseUp}
      onObjectChange={emitTransformSnapshot}
    />
  )
}

function IfcProbeBridge({ ifcModel, onIfcProbe, transformControlsRef }: IfcProbeBridgeProps) {
  const { camera, gl } = useThree()

  const runProbeFromPointer = useCallback(
    (event: PointerEvent) => {
      if (!ifcModel || event.button !== 0) {
        return
      }

      const transformControls = transformControlsRef.current
      // Step 10：操作 gizmo（hover/drag）時略過 IFC probe，避免 transform 互動被誤判成場景點選。
      const transformControlRuntimeState = transformControls as unknown as
        | {
            dragging?: boolean
            axis?: string | null
          }
        | null
      if (transformControlRuntimeState?.dragging || transformControlRuntimeState?.axis) {
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
    [camera, gl, ifcModel, onIfcProbe, transformControlsRef],
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

function ViewerCanvas({
  orbitEnabled = true,
  ifcModel,
  selectedObject,
  transformMode,
  onIfcProbe,
  onTransformModeChange,
  onTransformDraggingChange,
  onTransformSnapshotChange,
}: ViewerCanvasProps) {
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null)
  const transformControlsRef = useRef<TransformControlsImpl | null>(null)

  return (
    <Canvas camera={{ position: [5.4, 3.8, 5.4], fov: 50, near: 0.1, far: 120 }}>
      {/* Step 3 補上可互動的 OrbitControls，並保留 enabled 入口給後續 TransformControls 停用控制。 */}
      <OrbitControls
        makeDefault
        ref={orbitControlsRef}
        enabled={orbitEnabled}
        // 由 fitCameraToObject 以 imperative 方式維護 target/min/maxDistance，避免 React re-render 覆寫後造成視角跳動。
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.72}
        panSpeed={0.88}
        zoomSpeed={0.9}
      />

      <color attach="background" args={["#ecf2f8"]} />
      <ambientLight intensity={0.66} />
      <hemisphereLight intensity={0.42} groundColor="#d9e7f2" color="#f6fbff" />
      <directionalLight intensity={0.85} position={[8, 10, 6]} />
      <gridHelper args={[20, 20, '#9cb2c4', '#c8d8e4']} position={[0, -0.6, 0]} />
      <axesHelper args={[2]} />

      <IfcRuntimeBridge ifcModel={ifcModel} />
      <CameraFitBridge ifcModel={ifcModel} orbitControlsRef={orbitControlsRef} />
      <TransformControlsBridge
        ifcModel={ifcModel}
        selectedObject={selectedObject}
        transformMode={transformMode}
        transformControlsRef={transformControlsRef}
        onTransformModeChange={onTransformModeChange}
        onTransformDraggingChange={onTransformDraggingChange}
        onTransformSnapshotChange={onTransformSnapshotChange}
      />
      <IfcProbeBridge ifcModel={ifcModel} onIfcProbe={onIfcProbe} transformControlsRef={transformControlsRef} />

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
