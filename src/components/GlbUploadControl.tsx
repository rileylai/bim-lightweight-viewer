import type { ChangeEvent } from 'react'
import type { GlbUploadState } from '../types/glb'

interface GlbUploadControlProps {
  uploadState: GlbUploadState
  onSelectGlbFile: (file: File | null) => void
}

function GlbUploadControl({ uploadState, onSelectGlbFile }: GlbUploadControlProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.currentTarget.files?.[0] ?? null
    onSelectGlbFile(nextFile)

    // 清空 input value，避免使用者重選同一檔案時 onChange 不觸發。
    event.currentTarget.value = ''
  }

  return (
    <div className="ifc-upload-control">
      <label className="toolbar-upload-button toolbar-upload-button-secondary">
        <input type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={handleFileChange} />
        <span>GLB/GLTF Upload</span>
      </label>
      <p className="ifc-toolbar-status" data-state={uploadState.status}>
        {uploadState.file ? uploadState.file.name : 'No GLB/GLTF file'}
      </p>
    </div>
  )
}

export default GlbUploadControl
