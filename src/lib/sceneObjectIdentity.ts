import type { IfcRaycastProbeResult, IfcRuntimeModel } from '../types/ifc'
import type {
  GlbProbeIdentityInput,
  GlbSceneObjectIdentity,
  IfcProbeIdentityInput,
  IfcSceneObjectIdentity,
  SceneObjectIdentity,
  SceneObjectIdentityReference,
  SceneObjectSelectionLevel,
  SceneObjectSelectionState,
} from '../types/sceneObjectIdentity'

const buildSceneObjectIdentityId = (reference: SceneObjectIdentityReference) =>
  `${reference.sourceType}:${reference.sourceId}:${reference.objectKey}`

const resolveIfcSelectionLevel = (input: IfcProbeIdentityInput): SceneObjectSelectionLevel => {
  if (input.hit.expressIdCandidate !== null || input.hit.itemDataExpressIdCandidate !== null) {
    return 'element'
  }

  if (input.hit.localId !== null || input.hit.itemId !== null) {
    return 'fragment'
  }

  return 'model'
}

const buildIfcObjectKey = (input: IfcProbeIdentityInput) => {
  if (input.hit.localId !== null) {
    return `local:${input.hit.localId}`
  }

  if (input.hit.itemId !== null) {
    return `item:${input.hit.itemId}`
  }

  return 'model-root'
}

const buildIfcDisplayLabel = (input: IfcProbeIdentityInput, level: SceneObjectSelectionLevel) => {
  const shortFileName = input.fileName.replace(/\.ifc$/i, '')

  if (level === 'element' || level === 'fragment') {
    return `${shortFileName} / local:${input.hit.localId ?? 'n/a'} / item:${input.hit.itemId ?? 'n/a'}`
  }

  return `${shortFileName} / model-root`
}

const buildGlbObjectKey = (input: GlbProbeIdentityInput) => `root:${input.rootObjectId ?? 'scene-root'}`

const buildGlbDisplayLabel = (input: GlbProbeIdentityInput) => {
  const shortFileName = input.fileName.replace(/\.(glb|gltf)$/i, '')
  return `${shortFileName} / ${input.nodePath ?? 'root'}`
}

export const createIfcSceneObjectIdentity = (input: IfcProbeIdentityInput): IfcSceneObjectIdentity => {
  const selectionLevel = resolveIfcSelectionLevel(input)
  const objectKey = buildIfcObjectKey(input)
  const sourceId = input.modelId
  const reference = {
    sourceType: 'ifc',
    sourceId,
    objectKey,
  } satisfies SceneObjectIdentityReference

  // Step 8A：IFC probe 命中結果先統一收斂成 sourceType/sourceId/objectKey，供 selection/transform/save 共用。
  return {
    ...reference,
    identityId: buildSceneObjectIdentityId(reference),
    selectionLevel,
    displayLabel: buildIfcDisplayLabel(input, selectionLevel),
    metadata: {
      fileName: input.fileName,
      modelId: input.modelId,
      localId: input.hit.localId,
      itemId: input.hit.itemId,
      expressId: input.hit.expressIdCandidate ?? input.hit.itemDataExpressIdCandidate,
      representationClass: input.hit.representationClass,
      snappingClass: input.hit.snappingClass,
    },
  }
}

export const createGlbSceneObjectIdentity = (input: GlbProbeIdentityInput): GlbSceneObjectIdentity => {
  const objectKey = buildGlbObjectKey(input)
  const reference = {
    sourceType: 'glb',
    sourceId: input.sourceId,
    objectKey,
  } satisfies SceneObjectIdentityReference
  const selectionLevel: SceneObjectSelectionLevel = input.nodePath ? 'node' : 'model'

  // Step 17：GLB 命中節點先統一映射為 shared identity，TransformControls 仍以 root 為 attach target。
  return {
    ...reference,
    identityId: buildSceneObjectIdentityId(reference),
    selectionLevel,
    displayLabel: buildGlbDisplayLabel(input),
    metadata: {
      fileName: input.fileName,
      rootObjectId: input.rootObjectId,
      nodePath: input.nodePath,
    },
  }
}

export const mapIfcProbeToSceneObjectIdentity = (
  ifcModel: IfcRuntimeModel | null,
  probeResult: IfcRaycastProbeResult,
): SceneObjectIdentity | null => {
  if (!ifcModel || probeResult.status !== 'hit' || !probeResult.hit) {
    return null
  }

  return createIfcSceneObjectIdentity({
    modelId: ifcModel.modelId,
    fileName: ifcModel.fileName,
    hit: probeResult.hit,
  })
}

export const createNextSelectionState = (
  previousState: SceneObjectSelectionState,
  selectedObject: SceneObjectIdentity | null,
): SceneObjectSelectionState => {
  if (!selectedObject) {
    return {
      selectedObject: null,
      updatedAt: new Date().toISOString(),
    }
  }

  if (
    previousState.selectedObject?.identityId === selectedObject.identityId &&
    previousState.selectedObject.selectionLevel === selectedObject.selectionLevel &&
    previousState.selectedObject.displayLabel === selectedObject.displayLabel
  ) {
    return previousState
  }

  return {
    selectedObject,
    updatedAt: new Date().toISOString(),
  }
}

export const toSceneObjectReference = (identity: SceneObjectIdentity): SceneObjectIdentityReference => ({
  sourceType: identity.sourceType,
  sourceId: identity.sourceId,
  objectKey: identity.objectKey,
})
