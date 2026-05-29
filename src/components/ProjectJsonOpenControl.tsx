import type { ChangeEvent } from 'react'

interface ProjectJsonOpenControlProps {
  onSelectProjectJsonFile: (file: File | null) => void
}

function ProjectJsonOpenControl({ onSelectProjectJsonFile }: ProjectJsonOpenControlProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.currentTarget.files?.[0] ?? null
    onSelectProjectJsonFile(nextFile)

    // 清空 input value，避免使用者重選同一檔案時 onChange 不觸發。
    event.currentTarget.value = ''
  }

  return (
    <div className="ifc-upload-control">
      <label className="toolbar-upload-button toolbar-upload-button-secondary">
        <input type="file" accept=".json,application/json" onChange={handleFileChange} />
        <span>Open Project JSON</span>
      </label>
    </div>
  )
}

export default ProjectJsonOpenControl
