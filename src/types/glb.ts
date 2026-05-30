import type { Object3D } from 'three'

export type GlbUploadStatus = 'idle' | 'loading' | 'loaded' | 'invalid' | 'error'

export interface GlbUploadState {
  file: File | null
  status: GlbUploadStatus
  message: string
}

export interface GlbRuntimeModel {
  sourceType: 'glb'
  sourceId: string
  fileName: string
  rootObjectId: string | null
  nodePath: string | null
  object: Object3D
}
