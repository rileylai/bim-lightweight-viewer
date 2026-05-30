import type { IfcRaycastProbeHit } from './ifc'

export type SceneObjectSourceType = 'ifc' | 'glb'
export type SceneObjectSelectionLevel = 'model' | 'fragment' | 'element' | 'node'

export interface SceneObjectIdentityReference {
  sourceType: SceneObjectSourceType
  sourceId: string
  objectKey: string
}

interface SceneObjectIdentityBase extends SceneObjectIdentityReference {
  identityId: string
  selectionLevel: SceneObjectSelectionLevel
  displayLabel: string
}

export interface IfcSceneObjectMetadata {
  fileName: string
  modelId: string
  localId: number | null
  itemId: number | null
  expressId: number | null
  representationClass: string | null
  snappingClass: string | null
}

export interface IfcSceneObjectIdentity extends SceneObjectIdentityBase {
  sourceType: 'ifc'
  metadata: IfcSceneObjectMetadata
}

export interface GlbSceneObjectMetadata {
  fileName: string
  rootObjectId: string | null
  nodePath: string | null
}

export interface GlbSceneObjectIdentity extends SceneObjectIdentityBase {
  sourceType: 'glb'
  metadata: GlbSceneObjectMetadata
}

export type SceneObjectIdentity = IfcSceneObjectIdentity | GlbSceneObjectIdentity

export type SceneObjectTransformMode = 'translate' | 'rotate' | 'scale'

export interface SceneObjectSelectionState {
  selectedObject: SceneObjectIdentity | null
  updatedAt: string | null
}

export interface SceneObjectTransformSnapshot {
  objectRef: SceneObjectIdentityReference
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface SceneObjectTransformState {
  mode: SceneObjectTransformMode
  isDragging: boolean
  snapshot: SceneObjectTransformSnapshot | null
  updatedAt: string | null
}

export interface IfcProbeIdentityInput {
  modelId: string
  fileName: string
  hit: IfcRaycastProbeHit
}

export interface GlbProbeIdentityInput {
  sourceId: string
  fileName: string
  rootObjectId: string | null
  nodePath: string | null
}
