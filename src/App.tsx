import { useRef, useState } from 'react'
import IfcUploadControl from './components/IfcUploadControl'
import ViewerCanvas from './components/ViewerCanvas'
import { loadIfcRuntimeModel } from './lib/ifcLoaderRuntime'
import type {
  IfcLoadProcess,
  IfcLoadProcessState,
  IfcLoadProgressState,
  IfcRuntimeModel,
  IfcUploadState,
} from './types/ifc'
import './App.css'

const initialIfcUploadState: IfcUploadState = {
  file: null,
  status: 'idle',
  message: '尚未選擇 IFC 檔案。',
}

const initialIfcLoadProgressState: IfcLoadProgressState = {
  percent: null,
  process: null,
  processState: null,
  entitiesProcessed: null,
}

const ifcProcessLabelMap: Record<Exclude<IfcLoadProcess, null>, string> = {
  conversion: '整體轉換',
  geometries: '幾何解析',
  attributes: '屬性解析',
  relations: '關聯解析',
}

const ifcProcessStateLabelMap: Record<Exclude<IfcLoadProcessState, null>, string> = {
  start: '開始',
  inProgress: '進行中',
  finish: '完成',
}

function App() {
  const orbitControlsEnabled = true
  const [ifcUploadState, setIfcUploadState] = useState<IfcUploadState>(initialIfcUploadState)
  const [ifcLoadProgress, setIfcLoadProgress] = useState<IfcLoadProgressState>(initialIfcLoadProgressState)
  const [ifcRuntimeModel, setIfcRuntimeModel] = useState<IfcRuntimeModel | null>(null)
  const latestLoadRequestIdRef = useRef(0)

  const toErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message
    }

    return '未知錯誤'
  }

  const normalizeProgressPercent = (progress: number) => {
    const rawPercent = progress <= 1 ? progress * 100 : progress
    const clampedPercent = Math.max(0, Math.min(100, rawPercent))
    return Math.round(clampedPercent)
  }

  const getIfcProcessLabel = (process: IfcLoadProcess) => {
    if (!process) {
      return '準備中'
    }

    return ifcProcessLabelMap[process]
  }

  const getIfcProcessStateLabel = (processState: IfcLoadProcessState) => {
    if (!processState) {
      return '等待中'
    }

    return ifcProcessStateLabelMap[processState]
  }

  const handleSelectIfcFile = async (file: File | null) => {
    if (!file) {
      return
    }

    const isIfcFile = file.name.toLowerCase().endsWith('.ifc')
    if (!isIfcFile) {
      setIfcLoadProgress(initialIfcLoadProgressState)
      setIfcUploadState({
        file,
        status: 'invalid',
        message: '檔案格式錯誤：請選擇 .ifc 檔案。',
      })
      return
    }

    const requestId = latestLoadRequestIdRef.current + 1
    latestLoadRequestIdRef.current = requestId

    setIfcLoadProgress(initialIfcLoadProgressState)
    setIfcUploadState({
      file,
      status: 'loading',
      message: `IFC 解析與載入中：${file.name}`,
    })

    try {
      const loadedIfcModel = await loadIfcRuntimeModel(file, (progress, detail) => {
        if (latestLoadRequestIdRef.current !== requestId) {
          return
        }

        const nextProgress: IfcLoadProgressState = {
          percent: normalizeProgressPercent(progress),
          process: detail.process ?? null,
          processState: detail.state ?? null,
          entitiesProcessed: detail.entitiesProcessed ?? null,
        }

        setIfcLoadProgress((previousProgress) => {
          if (
            previousProgress.percent === nextProgress.percent &&
            previousProgress.process === nextProgress.process &&
            previousProgress.processState === nextProgress.processState &&
            previousProgress.entitiesProcessed === nextProgress.entitiesProcessed
          ) {
            return previousProgress
          }

          return nextProgress
        })

        const processLabel = getIfcProcessLabel(nextProgress.process)
        const processStateLabel = getIfcProcessStateLabel(nextProgress.processState)
        const percentLabel = nextProgress.percent === null ? '--' : `${nextProgress.percent}%`

        setIfcUploadState({
          file,
          status: 'loading',
          message: `IFC 載入中：${processLabel}（${processStateLabel}，${percentLabel}）`,
        })
      })

      if (latestLoadRequestIdRef.current !== requestId) {
        return
      }

      setIfcLoadProgress((previousProgress) => ({
        ...previousProgress,
        percent: 100,
        process: previousProgress.process ?? 'conversion',
        processState: 'finish',
      }))
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
          <span className="status-pill">Step 6</span>
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
          {ifcUploadState.status === 'loading' && (
            <section className="ifc-progress-card" aria-label="IFC loading progress">
              <div className="ifc-progress-head">
                <strong>IFC Loading Progress</strong>
                <span>{ifcLoadProgress.percent === null ? '--' : `${ifcLoadProgress.percent}%`}</span>
              </div>
              <progress
                className="ifc-progress-bar"
                max={100}
                value={ifcLoadProgress.percent === null ? undefined : ifcLoadProgress.percent}
              />
              <p className="ifc-progress-meta">
                Stage: {getIfcProcessLabel(ifcLoadProgress.process)} / {getIfcProcessStateLabel(ifcLoadProgress.processState)}
                {ifcLoadProgress.entitiesProcessed === null ? '' : ` / Processed: ${ifcLoadProgress.entitiesProcessed}`}
              </p>
            </section>
          )}
          <p>此步驟已補上 loading / progress / error 顯示，下一步會強化 camera fit。</p>
        </aside>
      </section>
    </main>
  )
}

export default App
