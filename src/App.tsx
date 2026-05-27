import { useRef, useState } from 'react'
import IfcUploadControl from './components/IfcUploadControl'
import ViewerCanvas from './components/ViewerCanvas'
import { loadIfcRuntimeModel } from './lib/ifcLoaderRuntime'
import type { IfcRuntimeModel, IfcUploadState } from './types/ifc'
import './App.css'

const initialIfcUploadState: IfcUploadState = {
  file: null,
  status: 'idle',
  message: '尚未選擇 IFC 檔案。',
}

function App() {
  const orbitControlsEnabled = true
  const [ifcUploadState, setIfcUploadState] = useState<IfcUploadState>(initialIfcUploadState)
  const [ifcRuntimeModel, setIfcRuntimeModel] = useState<IfcRuntimeModel | null>(null)
  const latestLoadRequestIdRef = useRef(0)

  const toErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message
    }

    return '未知錯誤'
  }

  const handleSelectIfcFile = async (file: File | null) => {
    if (!file) {
      return
    }

    const isIfcFile = file.name.toLowerCase().endsWith('.ifc')
    if (!isIfcFile) {
      setIfcUploadState({
        file,
        status: 'invalid',
        message: '檔案格式錯誤：請選擇 .ifc 檔案。',
      })
      return
    }

    setIfcUploadState({
      file,
      status: 'loading',
      message: `IFC 解析與載入中：${file.name}`,
    })

    const requestId = latestLoadRequestIdRef.current + 1
    latestLoadRequestIdRef.current = requestId

    try {
      const loadedIfcModel = await loadIfcRuntimeModel(file)

      if (latestLoadRequestIdRef.current !== requestId) {
        return
      }

      setIfcRuntimeModel(loadedIfcModel)
      setIfcUploadState({
        file,
        status: 'loaded',
        message: `IFC 載入完成：${loadedIfcModel.fileName}`,
      })
    } catch (error) {
      if (latestLoadRequestIdRef.current !== requestId) {
        return
      }

      setIfcUploadState({
        file,
        status: 'error',
        message: `IFC 載入失敗：${toErrorMessage(error)}`,
      })
    }
  }

  return (
    <main className="app-shell">
      <header className="top-toolbar" aria-label="toolbar placeholder">
        <div>
          <p className="eyebrow">BIM Lightweight Viewer MVP</p>
          <h1>BIM 輕量檢視器</h1>
        </div>
        <div className="toolbar-actions">
          <IfcUploadControl uploadState={ifcUploadState} onSelectIfcFile={handleSelectIfcFile} />
          <button type="button" disabled>
            Move / Rotate / Scale (Step 10)
          </button>
          <span className="status-pill">Step 5</span>
        </div>
      </header>

      <section className="workspace-layout">
        <section className="viewer-panel" aria-label="3D viewer area">
          <div className="viewer-head">
            <h2>3D Viewer</h2>
            <p>OrbitControls 已啟用：左鍵旋轉、右鍵平移、滾輪縮放。</p>
          </div>
          <div className="viewer-canvas-wrapper">
            <ViewerCanvas orbitEnabled={orbitControlsEnabled} ifcModel={ifcRuntimeModel} />
          </div>
        </section>

        <aside className="sidebar-panel" aria-label="sidebar placeholder">
          <h2>Sidebar Placeholder</h2>
          <ul>
            <li>Current model: {ifcRuntimeModel ? `${ifcRuntimeModel.sourceType}:${ifcRuntimeModel.modelId}` : 'none'}</li>
            <li>IFC file: {ifcUploadState.file ? ifcUploadState.file.name : 'none'}</li>
            <li>IFC status: {ifcUploadState.status}</li>
            <li>Selected object: none</li>
            <li>Transform mode: disabled</li>
            <li>Orbit controls: enabled</li>
          </ul>
          <p className={`ifc-state-message is-${ifcUploadState.status}`}>{ifcUploadState.message}</p>
          <p>此步驟已接上 IFC loader；下一步會補齊 loading / progress / error 的顯示細節。</p>
        </aside>
      </section>
    </main>
  )
}

export default App
