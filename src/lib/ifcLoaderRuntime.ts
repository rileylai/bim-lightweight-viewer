import * as OBC from '@thatopen/components'
import { RenderedFaces } from '@thatopen/fragments'
import type { FragmentsModel, MaterialDefinition, RaycastResult } from '@thatopen/fragments'
import { Color, Vector2 } from 'three'
import type { Object3D, OrthographicCamera, PerspectiveCamera } from 'three'
import type {
  IfcLoadProgressCallback,
  IfcRaycastProbeResult,
  IfcRuntimeModel,
  IfcSelectionProbeRequest,
} from '../types/ifc'

const IFC_WASM_PATH = 'https://unpkg.com/web-ifc@0.0.77/'

type ViewerCamera = PerspectiveCamera | OrthographicCamera

interface IfcRuntimeContext {
  components: OBC.Components
  fragments: OBC.FragmentsManager
  ifcLoader: OBC.IfcLoader
  activeModel: FragmentsModel | null
  activeCamera: ViewerCamera | null
}

let runtimeContext: IfcRuntimeContext | null = null
let runtimeContextPromise: Promise<IfcRuntimeContext> | null = null
let queuedCamera: ViewerCamera | null = null
let modelSerial = 0
let activeHighlightLocalId: number | null = null
let isModelWideHighlightActive = false

const IFC_SELECTED_HIGHLIGHT_MATERIAL: MaterialDefinition = {
  color: new Color('#ff9f40'),
  renderedFaces: RenderedFaces.TWO,
  opacity: 0.72,
  transparent: true,
  // Step 9：不能搭配 preserveOriginalMaterial=true 且缺 _explicitProps，否則 fragments 會保留原材質而看不到高亮。
  preserveOriginalMaterial: false,
}

const toFixedNumber = (value: number, digits = 4) => Number(value.toFixed(digits))

const toProbeVector = (vector: { x: number; y: number; z: number }) => ({
  x: toFixedNumber(vector.x),
  y: toFixedNumber(vector.y),
  z: toFixedNumber(vector.z),
})

const isValidNumeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const detectExpressIdFromRecord = (record: Record<string, unknown>) => {
  const directCandidateKeys = ['expressID', 'expressId', 'ifcExpressID', 'ifcExpressId']

  for (const key of directCandidateKeys) {
    const candidate = record[key]
    if (isValidNumeric(candidate)) {
      return candidate
    }
  }

  return null
}

const detectExpressIdFromItemData = (value: unknown, depth = 0): number | null => {
  if (depth > 4 || !value || typeof value !== 'object') {
    return null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const fromArrayItem = detectExpressIdFromItemData(item, depth + 1)
      if (fromArrayItem !== null) {
        return fromArrayItem
      }
    }

    return null
  }

  const record = value as Record<string, unknown>
  const directCandidate = detectExpressIdFromRecord(record)
  if (directCandidate !== null) {
    return directCandidate
  }

  for (const entry of Object.values(record)) {
    const nestedCandidate = detectExpressIdFromItemData(entry, depth + 1)
    if (nestedCandidate !== null) {
      return nestedCandidate
    }
  }

  return null
}

const getParentTrail = (object: Object3D, maxDepth = 6) => {
  const trail: string[] = []
  let current: Object3D | null = object
  let depth = 0

  while (current && depth < maxDepth) {
    const objectName = current.name ? current.name : '(unnamed)'
    trail.push(`${current.type}:${objectName}`)
    current = current.parent
    depth += 1
  }

  return trail
}

const detectExpressIdFromObjectTree = (object: Object3D) => {
  let current: Object3D | null = object
  let depth = 0

  while (current && depth < 6) {
    const candidate = detectExpressIdFromRecord(current.userData as Record<string, unknown>)
    if (candidate !== null) {
      return candidate
    }

    current = current.parent
    depth += 1
  }

  return null
}

const createProbeResult = (result: IfcRaycastProbeResult): IfcRaycastProbeResult => ({
  ...result,
  timestamp: new Date().toISOString(),
})

const getCameraDebugSnapshot = (camera: ViewerCamera | null) => {
  if (!camera) {
    return null
  }

  return {
    uuid: camera.uuid,
    type: camera.type,
    position: {
      x: toFixedNumber(camera.position.x),
      y: toFixedNumber(camera.position.y),
      z: toFixedNumber(camera.position.z),
    },
    rotation: {
      x: toFixedNumber(camera.rotation.x),
      y: toFixedNumber(camera.rotation.y),
      z: toFixedNumber(camera.rotation.z),
    },
    near: toFixedNumber(camera.near),
    far: toFixedNumber(camera.far),
  }
}

const summarizeRaycastResult = (hit: RaycastResult) => ({
  localId: hit.localId,
  itemId: hit.itemId,
  point: toProbeVector(hit.point),
  distance: toFixedNumber(hit.distance),
  objectType: hit.object?.type ?? null,
  objectName: hit.object?.name ?? null,
  representationClass: String(hit.representationClass),
  snappingClass: String(hit.snappingClass),
})

const createIfcModelId = (fileName: string) => {
  const normalizedName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  modelSerial += 1
  return `ifc-${modelSerial}-${normalizedName || 'model'}`
}

const ensureRuntimeContext = async () => {
  if (runtimeContext) {
    return runtimeContext
  }

  if (runtimeContextPromise) {
    return runtimeContextPromise
  }

  runtimeContextPromise = (async () => {
    const components = new OBC.Components()
    const fragments = components.get(OBC.FragmentsManager)
    const ifcLoader = components.get(OBC.IfcLoader)

    components.init()

    const workerUrl = await OBC.FragmentsManager.getWorker()
    fragments.init(workerUrl)

    await ifcLoader.setup({
      autoSetWasm: false,
      wasm: {
        path: IFC_WASM_PATH,
        absolute: true,
      },
    })

    const context: IfcRuntimeContext = {
      components,
      fragments,
      ifcLoader,
      activeModel: null,
      activeCamera: queuedCamera,
    }

    runtimeContext = context
    return context
  })()

  return runtimeContextPromise
}

const attachActiveCamera = (context: IfcRuntimeContext, model: FragmentsModel) => {
  if (!context.activeCamera) {
    return
  }

  model.useCamera(context.activeCamera)
}

export const bindIfcRuntimeCamera = (camera: ViewerCamera) => {
  queuedCamera = camera

  if (!runtimeContext) {
    return
  }

  runtimeContext.activeCamera = camera

  if (runtimeContext.activeModel) {
    runtimeContext.activeModel.useCamera(camera)
    runtimeContext.fragments.core.update(true)
  }
}

export const updateIfcRuntimeView = () => {
  if (!runtimeContext || !runtimeContext.activeModel) {
    return Promise.resolve()
  }

  return runtimeContext.fragments.core.update()
}

const resetActiveIfcHighlight = async (model: FragmentsModel) => {
  if (isModelWideHighlightActive) {
    await model.resetHighlight()
    isModelWideHighlightActive = false
    activeHighlightLocalId = null
    return
  }

  if (activeHighlightLocalId === null) {
    return
  }

  await model.resetHighlight([activeHighlightLocalId])
  activeHighlightLocalId = null
}

export const clearIfcRuntimeSelectionHighlight = async () => {
  if (!runtimeContext || !runtimeContext.activeModel) {
    activeHighlightLocalId = null
    isModelWideHighlightActive = false
    return
  }

  await resetActiveIfcHighlight(runtimeContext.activeModel)
}

export const setIfcRuntimeSelectionHighlight = async (localId: number | null) => {
  if (!runtimeContext || !runtimeContext.activeModel) {
    return
  }

  const model = runtimeContext.activeModel

  if (localId !== null && !isModelWideHighlightActive && activeHighlightLocalId === localId) {
    return
  }

  await resetActiveIfcHighlight(model)

  if (localId === null) {
    // 若只有 model-level identity（沒有 localId），先以整體模型高亮做 fallback，避免「已選取但無視覺回饋」。
    await model.highlight(undefined, IFC_SELECTED_HIGHLIGHT_MATERIAL)
    isModelWideHighlightActive = true
    activeHighlightLocalId = null
    return
  }

  await model.highlight([localId], IFC_SELECTED_HIGHLIGHT_MATERIAL)
  activeHighlightLocalId = localId
  isModelWideHighlightActive = false
}

export const loadIfcRuntimeModel = async (
  file: File,
  onProgress?: IfcLoadProgressCallback,
): Promise<IfcRuntimeModel> => {
  const context = await ensureRuntimeContext()
  const existingModelIds = Array.from(context.fragments.list.keys())

  const bytes = new Uint8Array(await file.arrayBuffer())
  const modelId = createIfcModelId(file.name)

  const fragmentsModel = await context.ifcLoader.load(bytes, true, modelId, {
    processData: {
      progressCallback: onProgress,
    },
  })

  attachActiveCamera(context, fragmentsModel)

  for (const existingModelId of existingModelIds) {
    if (existingModelId === modelId) {
      continue
    }

    const staleModel = context.fragments.list.get(existingModelId)
    staleModel?.dispose()
  }

  context.activeModel = fragmentsModel
  activeHighlightLocalId = null
  isModelWideHighlightActive = false
  context.fragments.core.update(true)

  return {
    sourceType: 'ifc',
    modelId,
    fileName: file.name,
    object: fragmentsModel.object,
  }
}

export const probeIfcRuntimeSelection = async (
  request: IfcSelectionProbeRequest,
): Promise<IfcRaycastProbeResult> => {
  if (!runtimeContext || !runtimeContext.activeModel) {
    return createProbeResult({
      status: 'no-model',
      message: '目前沒有可探測的 IFC model。',
      timestamp: null,
      hit: null,
    })
  }

  const model = runtimeContext.activeModel

  try {
    const rect = request.dom.getBoundingClientRect()
    const canvasRelativeX = request.clientX - rect.left
    const canvasRelativeY = request.clientY - rect.top

    const raycastPayload = {
      camera: request.camera,
      dom: request.dom,
      mouse: new Vector2(request.clientX, request.clientY),
    }

    const cameraIsActive = runtimeContext.activeCamera === request.camera

    // Step 8 補強：在 raycast 前先強制同步 fragments pending requests，降低視圖更新時序造成的 miss 偏差。
    await runtimeContext.fragments.core.update(true)

    // Step 8 診斷：確認 probe 使用的 camera 與 runtime active camera 是否同一個實例。
    console.log('[IfcProbeDebug] probe request', {
      modelId: model.modelId,
      browserClientX: request.clientX,
      browserClientY: request.clientY,
      canvasRelativeX: toFixedNumber(canvasRelativeX, 3),
      canvasRelativeY: toFixedNumber(canvasRelativeY, 3),
      domRect: {
        left: toFixedNumber(rect.left, 3),
        top: toFixedNumber(rect.top, 3),
        width: toFixedNumber(rect.width, 3),
        height: toFixedNumber(rect.height, 3),
      },
      raycastPayloadMouse: {
        x: toFixedNumber(raycastPayload.mouse.x, 3),
        y: toFixedNumber(raycastPayload.mouse.y, 3),
        space: 'browser-client-coordinate',
      },
      cameraIsActive,
      requestCamera: getCameraDebugSnapshot(request.camera),
      activeCamera: getCameraDebugSnapshot(runtimeContext.activeCamera),
    })

    const hit = await model.raycast(raycastPayload)

    // Step 8 診斷：檢查 fragments 單筆 raycast 原始回傳內容。
    console.log('[IfcProbeDebug] raycast raw result', hit)

    let allHits: RaycastResult[] | null = null
    try {
      allHits = await model.raycastAll(raycastPayload)
      console.log('[IfcProbeDebug] raycastAll raw results', allHits)
      console.log(
        '[IfcProbeDebug] raycastAll summary',
        allHits?.map((candidate) => summarizeRaycastResult(candidate)) ?? null,
      )
    } catch (error) {
      console.warn('[IfcProbeDebug] raycastAll failed', error)
    }

    console.log('[IfcProbeDebug] selection filter policy', {
      objectFilter: 'none',
      representationClassFilter: 'none',
      snappingClassFilter: 'none',
    })

    if (!hit) {
      if (allHits && allHits.length > 0) {
        console.log('[IfcProbeDebug] raycast miss but raycastAll has candidates', {
          candidateCount: allHits.length,
        })
      }

      return createProbeResult({
        status: 'miss',
        message: 'Raycast 未命中 IFC 幾何。',
        timestamp: null,
        hit: null,
      })
    }

    let itemDataTopLevelKeys: string[] = []
    let itemDataExpressIdCandidate: number | null = null

    try {
      const itemData = await model.getItemsData([hit.localId])
      const firstItemData = itemData[0]
      if (firstItemData && typeof firstItemData === 'object') {
        itemDataTopLevelKeys = Object.keys(firstItemData as Record<string, unknown>).slice(0, 12)
        itemDataExpressIdCandidate = detectExpressIdFromItemData(firstItemData)
      }
    } catch (error) {
      console.warn('[IfcProbe] getItemsData failed', error)
    }

    console.log('[IfcProbeDebug] selected hit summary', summarizeRaycastResult(hit))

    return createProbeResult({
      status: 'hit',
      message: `Raycast 命中 localId=${hit.localId} / itemId=${hit.itemId}`,
      timestamp: null,
      hit: {
        localId: hit.localId,
        itemId: hit.itemId,
        distance: toFixedNumber(hit.distance),
        point: toProbeVector(hit.point),
        representationClass: String(hit.representationClass),
        snappingClass: String(hit.snappingClass),
        objectType: hit.object.type,
        objectName: hit.object.name || null,
        objectUuid: hit.object.uuid,
        objectUserDataKeys: Object.keys(hit.object.userData ?? {}).slice(0, 16),
        parentObjectTrail: getParentTrail(hit.object),
        expressIdCandidate: detectExpressIdFromObjectTree(hit.object),
        itemDataTopLevelKeys,
        itemDataExpressIdCandidate,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown error'
    return createProbeResult({
      status: 'error',
      message: `Raycast probe 發生錯誤：${errorMessage}`,
      timestamp: null,
      hit: null,
    })
  }
}
