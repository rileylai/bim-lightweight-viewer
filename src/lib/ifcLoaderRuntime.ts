import * as OBC from '@thatopen/components'
import type { FragmentsModel } from '@thatopen/fragments'
import type { OrthographicCamera, PerspectiveCamera } from 'three'
import type { IfcLoadProgressCallback, IfcRuntimeModel } from '../types/ifc'

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
    return
  }

  runtimeContext.fragments.core.update()
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
  context.fragments.core.update(true)

  return {
    sourceType: 'ifc',
    modelId,
    fileName: file.name,
    object: fragmentsModel.object,
  }
}
