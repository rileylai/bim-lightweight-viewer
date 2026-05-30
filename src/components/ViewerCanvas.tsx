import { useCallback, useEffect, useMemo, useRef } from 'react'
import { OrbitControls, TransformControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import { Box3, Raycaster, Vector2, Vector3 } from 'three'
import type { Group, Mesh, Object3D, OrthographicCamera, PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl, TransformControls as TransformControlsImpl } from 'three-stdlib'
import { fitCameraToObject } from '../lib/fitCameraToObject'
import { bindIfcRuntimeCamera, probeIfcRuntimeSelection, updateIfcRuntimeView } from '../lib/ifcLoaderRuntime'
import type { GlbRuntimeModel } from '../types/glb'
import type { IfcRaycastProbeResult, IfcRuntimeModel } from '../types/ifc'
import {
  createGlbSceneObjectIdentity,
  mapIfcProbeToSceneObjectIdentity,
  toSceneObjectReference,
} from '../lib/sceneObjectIdentity'
import type {
  GlbSceneObjectIdentity,
  SceneObjectIdentity,
  SceneObjectTransformMode,
  SceneObjectTransformSnapshot,
} from '../types/sceneObjectIdentity'

interface ViewerCanvasProps {
  orbitEnabled?: boolean
  ifcModel: IfcRuntimeModel | null
  glbModels: GlbRuntimeModel[]
  selectedObject: SceneObjectIdentity | null
  transformMode: SceneObjectTransformMode
  onSceneSelectionChange: (selection: {
    selectedObject: SceneObjectIdentity | null
    ifcProbeResult: IfcRaycastProbeResult | null
  }) => void
  onTransformModeChange: (mode: SceneObjectTransformMode) => void
  onTransformDraggingChange: (isDragging: boolean) => void
  onTransformSnapshotChange: (snapshot: SceneObjectTransformSnapshot | null) => void
}

interface IfcRuntimeBridgeProps {
  ifcModel: IfcRuntimeModel | null
}

interface CameraFitBridgeProps {
  fitTargetModel: { fitId: string; object: Object3D } | null
  orbitControlsRef: RefObject<OrbitControlsImpl | null>
}

interface SceneProbeBridgeProps {
  ifcModel: IfcRuntimeModel | null
  glbModels: GlbRuntimeModel[]
  onSceneSelectionChange: (selection: {
    selectedObject: SceneObjectIdentity | null
    ifcProbeResult: IfcRaycastProbeResult | null
  }) => void
  transformControlsRef: RefObject<TransformControlsImpl | null>
}

interface TransformControlsBridgeProps {
  ifcModel: IfcRuntimeModel | null
  glbModels: GlbRuntimeModel[]
  selectedObject: SceneObjectIdentity | null
  transformMode: SceneObjectTransformMode
  transformControlsRef: RefObject<TransformControlsImpl | null>
  onTransformModeChange: (mode: SceneObjectTransformMode) => void
  onTransformDraggingChange: (isDragging: boolean) => void
  onTransformSnapshotChange: (snapshot: SceneObjectTransformSnapshot | null) => void
}

interface GlbSelectionProbeResult {
  identity: GlbSceneObjectIdentity
  distance: number
}

const DEBUG_GLB_HIGHLIGHT = false

const debugGlbHighlightLog = (label: string, payload: unknown) => {
  if (!DEBUG_GLB_HIGHLIGHT) {
    return
  }

  console.log(label, payload)
}

const findGlbRuntimeModelBySourceId = (glbModels: GlbRuntimeModel[], sourceId: string) =>
  glbModels.find((model) => model.sourceId === sourceId) ?? null

const resolveTransformTarget = (
  ifcModel: IfcRuntimeModel | null,
  glbModels: GlbRuntimeModel[],
  selectedObject: SceneObjectIdentity | null,
) => {
  if (!selectedObject) {
    return null
  }

  if (selectedObject.sourceType === 'ifc') {
    if (!ifcModel || selectedObject.sourceId !== ifcModel.modelId) {
      return null
    }

    return ifcModel.object
  }

  return findGlbRuntimeModelBySourceId(glbModels, selectedObject.sourceId)?.object ?? null
}

const buildGlbNodePath = (rootObject: Object3D, targetObject: Object3D) => {
  const nodeSegments: string[] = []
  let currentObject: Object3D | null = targetObject

  while (currentObject) {
    nodeSegments.push(currentObject.name || currentObject.type)
    if (currentObject === rootObject) {
      nodeSegments.reverse()
      return nodeSegments.join('/')
    }
    currentObject = currentObject.parent
  }

  return null
}

const findGlbModelFromHitObject = (glbModels: GlbRuntimeModel[], hitObject: Object3D) => {
  let currentObject: Object3D | null = hitObject

  while (currentObject) {
    const matchedModel = glbModels.find((glbModel) => glbModel.object === currentObject)
    if (matchedModel) {
      return matchedModel
    }
    currentObject = currentObject.parent
  }

  return null
}

const probeGlbSelection = (
  glbModels: GlbRuntimeModel[],
  camera: PerspectiveCamera | OrthographicCamera,
  ndcX: number,
  ndcY: number,
) => {
  if (glbModels.length === 0 || !Number.isFinite(ndcX) || !Number.isFinite(ndcY)) {
    return null
  }

  const raycaster = new Raycaster()
  const pointer = new Vector2(ndcX, ndcY)
  raycaster.setFromCamera(pointer, camera)

  const intersections = raycaster.intersectObjects(
    glbModels.map((glbModel) => glbModel.object),
    true,
  )

  // Step 17：GLB 可沿用 Three.js raycast；命中子節點後回推到所屬 root model 並建立 shared identity。
  for (const intersection of intersections) {
    const matchedModel = findGlbModelFromHitObject(glbModels, intersection.object)
    if (!matchedModel) {
      continue
    }

    const nodePath = buildGlbNodePath(matchedModel.object, intersection.object)
    return {
      identity: createGlbSceneObjectIdentity({
        sourceId: matchedModel.sourceId,
        fileName: matchedModel.fileName,
        rootObjectId: matchedModel.rootObjectId,
        nodePath,
      }),
      distance: intersection.distance,
    } satisfies GlbSelectionProbeResult
  }

  return null
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

function CameraFitBridge({ fitTargetModel, orbitControlsRef }: CameraFitBridgeProps) {
  const { camera, size } = useThree()
  const fittedModelIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!fitTargetModel) {
      // 當前場景沒有可對焦模型時重置 fit 記錄，避免下次載入新模型被誤判為已完成。
      fittedModelIdRef.current = null
    }
  }, [fitTargetModel])

  useEffect(() => {
    if (!fitTargetModel || !fitTargetModel.object || size.width <= 0 || size.height <= 0) {
      return
    }

    if (fittedModelIdRef.current === fitTargetModel.fitId) {
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
      if (fittedModelIdRef.current === fitTargetModel.fitId) {
        return true
      }

      const fitApplied = fitCameraToObject(camera, fitTargetModel.object, {
        controls: orbitControlsRef.current,
      })

      if (fitApplied) {
        fittedModelIdRef.current = fitTargetModel.fitId
        return true
      }

      if (!fitApplied) {
        console.warn('[CameraFit] fit failed', {
          trigger,
          modelId: fitTargetModel.fitId,
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
  }, [camera, fitTargetModel, orbitControlsRef, size])

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
  glbModels,
  selectedObject,
  transformMode,
  transformControlsRef,
  onTransformModeChange,
  onTransformDraggingChange,
  onTransformSnapshotChange,
}: TransformControlsBridgeProps) {
  const transformTarget = useMemo(
    () => resolveTransformTarget(ifcModel, glbModels, selectedObject),
    [glbModels, ifcModel, selectedObject],
  )

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

function SceneProbeBridge({ ifcModel, glbModels, onSceneSelectionChange, transformControlsRef }: SceneProbeBridgeProps) {
  const { camera, gl } = useThree()
  const probeSequenceRef = useRef(0)

  const runProbeFromPointer = useCallback(
    (event: PointerEvent) => {
      if (event.button !== 0 || (!ifcModel && glbModels.length === 0)) {
        return
      }

      const probeSequence = probeSequenceRef.current + 1
      probeSequenceRef.current = probeSequence

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
        modelId: ifcModel?.modelId ?? null,
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

      const glbHit = probeGlbSelection(glbModels, camera as PerspectiveCamera | OrthographicCamera, ndcX, ndcY)
      debugGlbHighlightLog('[SceneProbeDebug] glb probe candidate', {
        probeSequence,
        hasIfcModel: Boolean(ifcModel),
        glbModelCount: glbModels.length,
        hasGlbHit: Boolean(glbHit),
        glbDistance: glbHit?.distance ?? null,
        glbSourceId: glbHit?.identity.sourceId ?? null,
      })
      if (!ifcModel) {
        debugGlbHighlightLog('[SceneProbeDebug] apply glb-only selection', {
          probeSequence,
          selectedSourceType: glbHit?.identity.sourceType ?? null,
          selectedSourceId: glbHit?.identity.sourceId ?? null,
          selectedIdentityId: glbHit?.identity.identityId ?? null,
        })
        onSceneSelectionChange({
          selectedObject: glbHit?.identity ?? null,
          ifcProbeResult: null,
        })
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
      }).then((ifcProbeResult) => {
        const ifcIdentity = mapIfcProbeToSceneObjectIdentity(ifcModel, ifcProbeResult)
        const ifcDistance =
          ifcProbeResult.status === 'hit' ? ifcProbeResult.hit?.distance ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY
        const glbDistance = glbHit?.distance ?? Number.POSITIVE_INFINITY

        let selectedObject: SceneObjectIdentity | null = null
        // Step 17：IFC 與 GLB 同時命中時，以距離最近的候選做選取，避免兩套 probe 互相覆蓋。
        if (ifcIdentity && glbHit) {
          selectedObject = ifcDistance <= glbDistance ? ifcIdentity : glbHit.identity
        } else if (ifcIdentity) {
          selectedObject = ifcIdentity
        } else if (glbHit) {
          selectedObject = glbHit.identity
        }

        debugGlbHighlightLog('[SceneProbeDebug] ifc/glb selection compare', {
          probeSequence,
          ifcProbeStatus: ifcProbeResult.status,
          ifcDistance: Number.isFinite(ifcDistance) ? ifcDistance : null,
          ifcSourceId: ifcIdentity?.sourceId ?? null,
          glbDistance: Number.isFinite(glbDistance) ? glbDistance : null,
          glbSourceId: glbHit?.identity.sourceId ?? null,
          selectedSourceType: selectedObject?.sourceType ?? null,
          selectedSourceId: selectedObject?.sourceId ?? null,
          selectedIdentityId: selectedObject?.identityId ?? null,
        })

        onSceneSelectionChange({
          selectedObject,
          ifcProbeResult,
        })
      })
    },
    [camera, gl, glbModels, ifcModel, onSceneSelectionChange, transformControlsRef],
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

function GlbSelectionHighlightBridge({
  glbModels,
  selectedObject,
}: {
  glbModels: GlbRuntimeModel[]
  selectedObject: SceneObjectIdentity | null
}) {
  const highlightGroupRef = useRef<Group | null>(null)
  const highlightFillMeshRef = useRef<Mesh | null>(null)
  const highlightEdgeMeshRef = useRef<Mesh | null>(null)
  const boxRef = useRef(new Box3())
  const centerRef = useRef(new Vector3())
  const sizeRef = useRef(new Vector3())
  const targetObject = useMemo(() => {
    if (!selectedObject || selectedObject.sourceType !== 'glb') {
      return null
    }

    return findGlbRuntimeModelBySourceId(glbModels, selectedObject.sourceId)?.object ?? null
  }, [glbModels, selectedObject])
  const lastDebugSnapshotRef = useRef<string | null>(null)
  const roundToDebugNumber = (value: number) => Number(value.toFixed(4))

  useEffect(() => {
    debugGlbHighlightLog('[GlbHighlightDebug] target resolve', {
      selectedIdentityId: selectedObject?.identityId ?? null,
      selectedSourceId: selectedObject?.sourceId ?? null,
      selectedSourceType: selectedObject?.sourceType ?? null,
      resolvedTargetUuid: targetObject?.uuid ?? null,
      resolvedTargetType: targetObject?.type ?? null,
      glbModelCount: glbModels.length,
    })
    lastDebugSnapshotRef.current = null
  }, [glbModels.length, selectedObject, targetObject])

  useFrame(() => {
    if (!targetObject || !highlightGroupRef.current || !highlightFillMeshRef.current || !highlightEdgeMeshRef.current) {
      return
    }

    targetObject.updateWorldMatrix(true, true)
    boxRef.current.setFromObject(targetObject, true)
    const isBoundingBoxEmpty = boxRef.current.isEmpty()
    if (isBoundingBoxEmpty) {
      highlightGroupRef.current.visible = false
      const emptySnapshot = JSON.stringify({
        targetUuid: targetObject.uuid,
        bboxEmpty: true,
        highlightGroupVisible: highlightGroupRef.current.visible,
      })
      if (lastDebugSnapshotRef.current !== emptySnapshot) {
        debugGlbHighlightLog('[GlbHighlightDebug] bbox empty', JSON.parse(emptySnapshot))
        lastDebugSnapshotRef.current = emptySnapshot
      }
      return
    }

    boxRef.current.getCenter(centerRef.current)
    boxRef.current.getSize(sizeRef.current)
    highlightGroupRef.current.visible = true
    highlightFillMeshRef.current.visible = true
    highlightEdgeMeshRef.current.visible = true

    highlightGroupRef.current.position.copy(centerRef.current)
    // Step 17 修補：高亮採 dual-layer overlay（fill + edge）提高遠近距辨識度。
    highlightGroupRef.current.scale.set(
      Math.max(sizeRef.current.x, 0.001),
      Math.max(sizeRef.current.y, 0.001),
      Math.max(sizeRef.current.z, 0.001),
    )

    const highlightSnapshot = JSON.stringify({
      targetUuid: targetObject.uuid,
      bboxEmpty: false,
      bboxSize: {
        x: roundToDebugNumber(sizeRef.current.x),
        y: roundToDebugNumber(sizeRef.current.y),
        z: roundToDebugNumber(sizeRef.current.z),
      },
      highlightPosition: {
        x: roundToDebugNumber(highlightGroupRef.current.position.x),
        y: roundToDebugNumber(highlightGroupRef.current.position.y),
        z: roundToDebugNumber(highlightGroupRef.current.position.z),
      },
      highlightScale: {
        x: roundToDebugNumber(highlightGroupRef.current.scale.x),
        y: roundToDebugNumber(highlightGroupRef.current.scale.y),
        z: roundToDebugNumber(highlightGroupRef.current.scale.z),
      },
      highlightGroupVisible: highlightGroupRef.current.visible,
      highlightFillVisible: highlightFillMeshRef.current.visible,
      highlightEdgeVisible: highlightEdgeMeshRef.current.visible,
    })
    if (lastDebugSnapshotRef.current !== highlightSnapshot) {
      debugGlbHighlightLog('[GlbHighlightDebug] bbox/highlight snapshot', JSON.parse(highlightSnapshot))
      lastDebugSnapshotRef.current = highlightSnapshot
    }
  })

  if (!targetObject) {
    return null
  }

  return (
    <group ref={highlightGroupRef} frustumCulled={false}>
      <mesh ref={highlightFillMeshRef} frustumCulled={false} renderOrder={998}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#ffb347"
          transparent
          opacity={0.16}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={highlightEdgeMeshRef} frustumCulled={false} renderOrder={999}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#ff7a00"
          wireframe
          transparent
          opacity={0.98}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function ViewerCanvas({
  orbitEnabled = true,
  ifcModel,
  glbModels,
  selectedObject,
  transformMode,
  onSceneSelectionChange,
  onTransformModeChange,
  onTransformDraggingChange,
  onTransformSnapshotChange,
}: ViewerCanvasProps) {
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null)
  const transformControlsRef = useRef<TransformControlsImpl | null>(null)
  const latestGlbModel = glbModels.length > 0 ? glbModels[glbModels.length - 1] : null
  const fitTargetModel = ifcModel
    ? { fitId: ifcModel.modelId, object: ifcModel.object }
    : latestGlbModel
      ? { fitId: latestGlbModel.sourceId, object: latestGlbModel.object }
      : null

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
      <CameraFitBridge fitTargetModel={fitTargetModel} orbitControlsRef={orbitControlsRef} />
      <TransformControlsBridge
        ifcModel={ifcModel}
        glbModels={glbModels}
        selectedObject={selectedObject}
        transformMode={transformMode}
        transformControlsRef={transformControlsRef}
        onTransformModeChange={onTransformModeChange}
        onTransformDraggingChange={onTransformDraggingChange}
        onTransformSnapshotChange={onTransformSnapshotChange}
      />
      <SceneProbeBridge
        ifcModel={ifcModel}
        glbModels={glbModels}
        onSceneSelectionChange={onSceneSelectionChange}
        transformControlsRef={transformControlsRef}
      />
      <GlbSelectionHighlightBridge glbModels={glbModels} selectedObject={selectedObject} />

      {ifcModel ? <primitive object={ifcModel.object} /> : null}

      {glbModels.map((glbModel) => (
        <primitive key={glbModel.sourceId} object={glbModel.object} />
      ))}

      {!ifcModel && glbModels.length === 0 ? (
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[1.4, 1.4, 1.4]} />
          <meshStandardMaterial color="#4d85ab" roughness={0.6} metalness={0.1} />
        </mesh>
      ) : null}

      <mesh position={[0, -0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#f7fbff" />
      </mesh>
    </Canvas>
  )
}

export default ViewerCanvas
