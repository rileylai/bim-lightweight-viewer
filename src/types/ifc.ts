import type { ProgressData } from '@thatopen/fragments'
import type { Object3D, OrthographicCamera, PerspectiveCamera } from 'three'

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

export interface IfcSelectionProbeRequest {
  camera: PerspectiveCamera | OrthographicCamera
  dom: HTMLCanvasElement
  // 這裡使用 browser client 座標（event.clientX / event.clientY），由 fragments 內部搭配 dom rect 轉換。
  clientX: number
  // 這裡使用 browser client 座標（event.clientX / event.clientY），由 fragments 內部搭配 dom rect 轉換。
  clientY: number
}

export interface IfcRaycastProbeHit {
  localId: number | null
  itemId: number | null
  distance: number | null
  point: { x: number; y: number; z: number } | null
  representationClass: string | null
  snappingClass: string | null
  objectType: string | null
  objectName: string | null
  objectUuid: string | null
  objectUserDataKeys: string[]
  parentObjectTrail: string[]
  expressIdCandidate: number | null
  itemDataTopLevelKeys: string[]
  itemDataExpressIdCandidate: number | null
}

export interface IfcRaycastProbeResult {
  status: 'idle' | 'no-model' | 'miss' | 'hit' | 'error'
  message: string
  timestamp: string | null
  hit: IfcRaycastProbeHit | null
}
