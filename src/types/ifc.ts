import type { ProgressData } from '@thatopen/fragments'
import type { Object3D } from 'three'

export type IfcUploadStatus = 'idle' | 'pending' | 'loading' | 'loaded' | 'invalid' | 'error'

export interface IfcUploadState {
  file: File | null
  status: IfcUploadStatus
  message: string
}

export type IfcLoadProcess = ProgressData['process'] | null
export type IfcLoadProcessState = ProgressData['state'] | null

export interface IfcLoadProgressState {
  percent: number | null
  process: IfcLoadProcess
  processState: IfcLoadProcessState
  entitiesProcessed: number | null
}

export interface IfcRuntimeModel {
  sourceType: 'ifc'
  modelId: string
  fileName: string
  object: Object3D
}

export type IfcLoadProgressCallback = (progress: number, detail: ProgressData) => void
