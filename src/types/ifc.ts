import type { ProgressData } from '@thatopen/fragments'
import type { Object3D } from 'three'

export type IfcUploadStatus = 'idle' | 'pending' | 'loading' | 'loaded' | 'invalid' | 'error'

export interface IfcUploadState {
  file: File | null
  status: IfcUploadStatus
  message: string
}

export interface IfcRuntimeModel {
  sourceType: 'ifc'
  modelId: string
  fileName: string
  object: Object3D
}

export type IfcLoadProgressCallback = (progress: number, detail: ProgressData) => void
