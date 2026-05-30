import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Object3D } from 'three'
import type { GlbRuntimeModel } from '../types/glb'

let glbModelSerial = 0

const createGlbSourceId = (fileName: string) => {
  const normalizedName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  glbModelSerial += 1
  return `glb-${glbModelSerial}-${normalizedName || 'model'}`
}

const resolveRootObject = (scene: Object3D, fallbackName: string) => {
  if (!scene.name) {
    scene.name = fallbackName
  }

  scene.updateMatrixWorld(true)
  return scene
}

export const loadGlbRuntimeModel = async (file: File): Promise<GlbRuntimeModel> => {
  const loader = new GLTFLoader()
  const objectUrl = URL.createObjectURL(file)

  try {
    const gltf = await loader.loadAsync(objectUrl)
    const rootObject = resolveRootObject(gltf.scene, file.name)

    return {
      sourceType: 'glb',
      sourceId: createGlbSourceId(file.name),
      fileName: file.name,
      rootObjectId: rootObject.uuid ?? null,
      nodePath: null,
      object: rootObject,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown error'

    // Step 16：先確保單檔 GLB/GLTF 可載入；若 .gltf 依賴外部資源遺失，明確拋出可理解錯誤。
    throw new Error(`GLB/GLTF 載入失敗：${errorMessage}`, { cause: error })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
