export type IfcUploadStatus = 'idle' | 'pending' | 'invalid'

export interface IfcUploadState {
  file: File | null
  status: IfcUploadStatus
  message: string
}
