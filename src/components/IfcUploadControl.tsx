import type { ChangeEvent } from 'react'
import type { IfcUploadState } from '../types/ifc'

interface IfcUploadControlProps {
  uploadState: IfcUploadState
  onSelectIfcFile: (file: File | null) => void
}

function IfcUploadControl({ uploadState, onSelectIfcFile }: IfcUploadControlProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.currentTarget.files?.[0] ?? null
    onSelectIfcFile(nextFile)

    // 清空 input value，避免使用者重選同一檔案時 onChange 不觸發。
    event.currentTarget.value = ''
  }

  return (
    <div className="ifc-upload-control">
      <label className="toolbar-upload-button">
        <input type="file" accept=".ifc" onChange={handleFileChange} />
        <span>IFC Upload</span>
      </label>
      <p className="ifc-toolbar-status" data-state={uploadState.status}>
        {uploadState.file ? uploadState.file.name : 'No IFC file'}
      </p>
    </div>
  )
}

export default IfcUploadControl
