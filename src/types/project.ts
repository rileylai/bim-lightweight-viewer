import type { SceneObjectIdentityReference } from './sceneObjectIdentity'

export const PROJECT_SCHEMA_KIND = 'bim-lightweight-viewer/project' as const
export const PROJECT_SCHEMA_VERSION = 1 as const

export type ProjectSchemaKind = typeof PROJECT_SCHEMA_KIND
export type ProjectSchemaVersion = typeof PROJECT_SCHEMA_VERSION
export type ProjectTransformVector3 = [number, number, number]

interface ProjectSourceBase {
  sourceId: string
  fileName: string
}

export interface ProjectIfcSource extends ProjectSourceBase {
  sourceType: 'ifc'
  modelId: string
}

export interface ProjectGlbSource extends ProjectSourceBase {
  sourceType: 'glb'
  rootObjectId: string | null
  nodePath: string | null
}

export type ProjectSource = ProjectIfcSource | ProjectGlbSource

export interface ProjectObjectTransformRecord {
  objectRef: SceneObjectIdentityReference
  position: ProjectTransformVector3
  rotation: ProjectTransformVector3
  scale: ProjectTransformVector3
}

export interface ProjectJsonV1 {
  schema: ProjectSchemaKind
  version: ProjectSchemaVersion
  createdAt: string
  updatedAt: string
  sources: ProjectSource[]
  objectTransforms: ProjectObjectTransformRecord[]
}

export type ProjectJsonDocument = ProjectJsonV1
