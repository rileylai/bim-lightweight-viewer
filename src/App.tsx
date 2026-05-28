import { useRef, useState } from 'react'
import IfcUploadControl from './components/IfcUploadControl'
import ViewerCanvas from './components/ViewerCanvas'
import { loadIfcRuntimeModel } from './lib/ifcLoaderRuntime'
import { createNextSelectionState, mapIfcProbeToSceneObjectIdentity } from './lib/sceneObjectIdentity'
import type {
  IfcLoadProcess,
  IfcLoadProcessState,
  IfcLoadProgressState,
  IfcRaycastProbeResult,
  IfcRuntimeModel,
  IfcUploadState,
} from './types/ifc'
import type { SceneObjectSelectionState } from './types/sceneObjectIdentity'
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

const initialIfcRaycastProbeState: IfcRaycastProbeResult = {
  status: 'idle',
  message: '尚未執行 IFC raycast 探針。',
  timestamp: null,
  hit: null,
}

const initialSceneObjectSelectionState: SceneObjectSelectionState = {
  selectedObject: null,
  updatedAt: null,
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
  const [ifcRaycastProbe, setIfcRaycastProbe] = useState<IfcRaycastProbeResult>(initialIfcRaycastProbeState)
  const [sceneObjectSelection, setSceneObjectSelection] = useState<SceneObjectSelectionState>(initialSceneObjectSelectionState)
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

  const handleIfcProbe = (probeResult: IfcRaycastProbeResult) => {
    setIfcRaycastProbe(probeResult)
    setSceneObjectSelection((previousSelection) =>
      createNextSelectionState(previousSelection, mapIfcProbeToSceneObjectIdentity(ifcRuntimeModel, probeResult)),
    )
  }

  const handleSelectIfcFile = async (file: File | null) => {
    if (!file) {
      return
    }

    const isIfcFile = file.name.toLowerCase().endsWith('.ifc')
    if (!isIfcFile) {
      setIfcLoadProgress(initialIfcLoadProgressState)
      setIfcRaycastProbe(initialIfcRaycastProbeState)
      setSceneObjectSelection(initialSceneObjectSelectionState)
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
    setIfcRaycastProbe(initialIfcRaycastProbeState)
    setSceneObjectSelection(initialSceneObjectSelectionState)
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
      setSceneObjectSelection(initialSceneObjectSelectionState)
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
          <span className="status-pill">Step 8A</span>
        </div>
      </header>

      <section className="workspace-layout">
        <section className="viewer-panel" aria-label="3D viewer area">
          <div className="viewer-head">
            <h2>3D Viewer</h2>
            <p>OrbitControls 已啟用：左鍵旋轉、右鍵平移、滾輪縮放。</p>
          </div>
          <div className="viewer-canvas-wrapper">
            <ViewerCanvas orbitEnabled={orbitControlsEnabled} ifcModel={ifcRuntimeModel} onIfcProbe={handleIfcProbe} />
          </div>
        </section>

        <aside className="sidebar-panel" aria-label="sidebar placeholder">
          <h2>Sidebar Placeholder</h2>
          <ul>
            <li>Current model: {ifcRuntimeModel ? `${ifcRuntimeModel.sourceType}:${ifcRuntimeModel.modelId}` : 'none'}</li>
            <li>IFC file: {ifcUploadState.file ? ifcUploadState.file.name : 'none'}</li>
            <li>IFC status: {ifcUploadState.status}</li>
            <li>IFC probe status: {ifcRaycastProbe.status}</li>
            <li>Selected identity: {sceneObjectSelection.selectedObject?.identityId ?? 'none'}</li>
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
          <section className={`ifc-probe-card is-${ifcRaycastProbe.status}`} aria-label="IFC raycast probe result">
            <h3>IFC Raycast Probe (Step 8)</h3>
            <p>{ifcRaycastProbe.message}</p>
            <p>Timestamp: {ifcRaycastProbe.timestamp ?? '--'}</p>
            {ifcRaycastProbe.hit ? (
              <ul>
                <li>localId: {ifcRaycastProbe.hit.localId ?? 'n/a'}</li>
                <li>itemId: {ifcRaycastProbe.hit.itemId ?? 'n/a'}</li>
                <li>expressID (object/userData): {ifcRaycastProbe.hit.expressIdCandidate ?? 'n/a'}</li>
                <li>expressID (itemData): {ifcRaycastProbe.hit.itemDataExpressIdCandidate ?? 'n/a'}</li>
                <li>
                  Point: {ifcRaycastProbe.hit.point ? `${ifcRaycastProbe.hit.point.x}, ${ifcRaycastProbe.hit.point.y}, ${ifcRaycastProbe.hit.point.z}` : 'n/a'}
                </li>
                <li>Distance: {ifcRaycastProbe.hit.distance ?? 'n/a'}</li>
                <li>
                  Hit object: {ifcRaycastProbe.hit.objectType ?? 'n/a'} / {ifcRaycastProbe.hit.objectName ?? '(unnamed)'}
                </li>
                <li>representationClass: {ifcRaycastProbe.hit.representationClass ?? 'n/a'}</li>
                <li>snappingClass: {ifcRaycastProbe.hit.snappingClass ?? 'n/a'}</li>
                <li>object userData keys: {ifcRaycastProbe.hit.objectUserDataKeys.join(', ') || 'none'}</li>
                <li>itemData keys: {ifcRaycastProbe.hit.itemDataTopLevelKeys.join(', ') || 'none'}</li>
                <li>parent trail: {ifcRaycastProbe.hit.parentObjectTrail.join(' -> ')}</li>
              </ul>
            ) : null}
          </section>
          <section className="ifc-probe-card" aria-label="Shared scene object identity">
            <h3>Shared Scene Object Identity (Step 8A)</h3>
            <p>
              {sceneObjectSelection.selectedObject
                ? `目前已對映 ${sceneObjectSelection.selectedObject.selectionLevel}-level identity。`
                : '尚未建立可用的 scene object identity。'}
            </p>
            <p>Updated at: {sceneObjectSelection.updatedAt ?? '--'}</p>
            {sceneObjectSelection.selectedObject ? (
              <ul>
                <li>identityId: {sceneObjectSelection.selectedObject.identityId}</li>
                <li>sourceType: {sceneObjectSelection.selectedObject.sourceType}</li>
                <li>sourceId: {sceneObjectSelection.selectedObject.sourceId}</li>
                <li>objectKey: {sceneObjectSelection.selectedObject.objectKey}</li>
                <li>selectionLevel: {sceneObjectSelection.selectedObject.selectionLevel}</li>
                <li>displayLabel: {sceneObjectSelection.selectedObject.displayLabel}</li>
                {sceneObjectSelection.selectedObject.sourceType === 'ifc' ? (
                  <>
                    <li>metadata.localId: {sceneObjectSelection.selectedObject.metadata.localId ?? 'n/a'}</li>
                    <li>metadata.itemId: {sceneObjectSelection.selectedObject.metadata.itemId ?? 'n/a'}</li>
                    <li>metadata.expressId: {sceneObjectSelection.selectedObject.metadata.expressId ?? 'n/a'}</li>
                  </>
                ) : null}
              </ul>
            ) : null}
          </section>
          <p>Step 8A 先統一 scene object identity model；Step 9 再把這個 identity 接到正式 selection/highlight。</p>
        </aside>
      </section>
    </main>
  )
}

export default App
