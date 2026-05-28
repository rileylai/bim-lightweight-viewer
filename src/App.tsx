import { useRef, useState } from 'react'
import IfcUploadControl from './components/IfcUploadControl'
import ViewerCanvas from './components/ViewerCanvas'
import { clearIfcRuntimeSelectionHighlight, loadIfcRuntimeModel, setIfcRuntimeSelectionHighlight } from './lib/ifcLoaderRuntime'
import { createNextSelectionState, mapIfcProbeToSceneObjectIdentity } from './lib/sceneObjectIdentity'
import type {
  IfcLoadProcess,
  IfcLoadProcessState,
  IfcLoadProgressState,
  IfcRaycastProbeResult,
  IfcRuntimeModel,
  IfcUploadState,
} from './types/ifc'
import type {
  SceneObjectSelectionState,
  SceneObjectTransformMode,
  SceneObjectTransformSnapshot,
  SceneObjectTransformState,
} from './types/sceneObjectIdentity'
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

const initialSceneObjectTransformState: SceneObjectTransformState = {
  mode: 'translate',
  isDragging: false,
  snapshot: null,
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
  const [orbitControlsEnabled, setOrbitControlsEnabled] = useState(true)
  const [ifcUploadState, setIfcUploadState] = useState<IfcUploadState>(initialIfcUploadState)
  const [ifcLoadProgress, setIfcLoadProgress] = useState<IfcLoadProgressState>(initialIfcLoadProgressState)
  const [ifcRuntimeModel, setIfcRuntimeModel] = useState<IfcRuntimeModel | null>(null)
  const [ifcRaycastProbe, setIfcRaycastProbe] = useState<IfcRaycastProbeResult>(initialIfcRaycastProbeState)
  const [sceneObjectSelection, setSceneObjectSelection] = useState<SceneObjectSelectionState>(initialSceneObjectSelectionState)
  const [sceneObjectTransform, setSceneObjectTransform] = useState<SceneObjectTransformState>(
    initialSceneObjectTransformState,
  )
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

  const syncSelectedHighlight = async (nextSelection: SceneObjectSelectionState['selectedObject']) => {
    if (!ifcRuntimeModel || !nextSelection || nextSelection.sourceType !== 'ifc') {
      await clearIfcRuntimeSelectionHighlight()
      return
    }

    if (nextSelection.sourceId !== ifcRuntimeModel.modelId) {
      await clearIfcRuntimeSelectionHighlight()
      return
    }

    // Step 9：選取命中後以 localId 高亮；若 localId 不可用則由 runtime fallback 到 model-level highlight。
    await setIfcRuntimeSelectionHighlight(nextSelection.metadata.localId)
  }

  const updateTransformMode = (nextMode: SceneObjectTransformMode) => {
    setSceneObjectTransform((previousTransformState) => {
      if (previousTransformState.mode === nextMode) {
        return previousTransformState
      }

      return {
        ...previousTransformState,
        mode: nextMode,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const updateTransformDraggingState = (isDragging: boolean) => {
    setOrbitControlsEnabled(!isDragging)
    setSceneObjectTransform((previousTransformState) => {
      if (previousTransformState.isDragging === isDragging) {
        return previousTransformState
      }

      return {
        ...previousTransformState,
        isDragging,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const updateTransformSnapshot = (snapshot: SceneObjectTransformSnapshot | null) => {
    setSceneObjectTransform((previousTransformState) => {
      if (previousTransformState.snapshot === snapshot) {
        return previousTransformState
      }

      return {
        ...previousTransformState,
        snapshot,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const resetTransformState = () => {
    setOrbitControlsEnabled(true)
    setSceneObjectTransform(initialSceneObjectTransformState)
  }

  const handleIfcProbe = (probeResult: IfcRaycastProbeResult) => {
    const nextIdentity = mapIfcProbeToSceneObjectIdentity(ifcRuntimeModel, probeResult)

    setIfcRaycastProbe(probeResult)
    setSceneObjectSelection((previousSelection) => createNextSelectionState(previousSelection, nextIdentity))

    void syncSelectedHighlight(nextIdentity).catch((error: unknown) => {
      console.warn('[IfcSelection] highlight update failed', error)
    })

    if (!nextIdentity) {
      resetTransformState()
    }
  }

  const handleSelectIfcFile = async (file: File | null) => {
    if (!file) {
      return
    }

    const isIfcFile = file.name.toLowerCase().endsWith('.ifc')
    if (!isIfcFile) {
      void clearIfcRuntimeSelectionHighlight()
      setIfcLoadProgress(initialIfcLoadProgressState)
      setIfcRaycastProbe(initialIfcRaycastProbeState)
      setSceneObjectSelection(initialSceneObjectSelectionState)
      resetTransformState()
      setIfcUploadState({
        file,
        status: 'invalid',
        message: '檔案格式錯誤：請選擇 .ifc 檔案。',
      })
      return
    }

    const requestId = latestLoadRequestIdRef.current + 1
    latestLoadRequestIdRef.current = requestId

    void clearIfcRuntimeSelectionHighlight()
    setIfcLoadProgress(initialIfcLoadProgressState)
    setIfcRaycastProbe(initialIfcRaycastProbeState)
    setSceneObjectSelection(initialSceneObjectSelectionState)
    resetTransformState()
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
      resetTransformState()
      setIfcUploadState({
        file,
        status: 'loaded',
        message: `IFC 載入完成：${loadedIfcModel.fileName}`,
      })
    } catch (error) {
      if (latestLoadRequestIdRef.current !== requestId) {
        return
      }

      void clearIfcRuntimeSelectionHighlight()
      resetTransformState()
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
            Transform mode: W / E / R（Toolbar 於 Step 11）
          </button>
          <span className="status-pill">Step 10</span>
        </div>
      </header>

      <section className="workspace-layout">
        <section className="viewer-panel" aria-label="3D viewer area">
          <div className="viewer-head">
            <h2>3D Viewer</h2>
            <p>OrbitControls：左鍵旋轉、右鍵平移、滾輪縮放；TransformControls mode 可用 W/E/R 切換。</p>
          </div>
          <div className="viewer-canvas-wrapper">
            <ViewerCanvas
              orbitEnabled={orbitControlsEnabled}
              ifcModel={ifcRuntimeModel}
              selectedObject={sceneObjectSelection.selectedObject}
              transformMode={sceneObjectTransform.mode}
              onIfcProbe={handleIfcProbe}
              onTransformModeChange={updateTransformMode}
              onTransformDraggingChange={updateTransformDraggingState}
              onTransformSnapshotChange={updateTransformSnapshot}
            />
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
            <li>Transform mode: {sceneObjectTransform.mode}</li>
            <li>Transform dragging: {sceneObjectTransform.isDragging ? 'yes' : 'no'}</li>
            <li>Orbit controls: {orbitControlsEnabled ? 'enabled' : 'disabled while transforming'}</li>
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
          <section className="ifc-probe-card" aria-label="Selected object state">
            <h3>Selected Object (Step 9)</h3>
            <p>
              {sceneObjectSelection.selectedObject
                ? `目前選取 ${sceneObjectSelection.selectedObject.selectionLevel}-level 物件，已套用高亮。`
                : '目前沒有選取物件，已清除高亮。'}
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
                    <li>transform target: IFC model root（Step 10 fallback）</li>
                    <li>metadata.localId: {sceneObjectSelection.selectedObject.metadata.localId ?? 'n/a'}</li>
                    <li>metadata.itemId: {sceneObjectSelection.selectedObject.metadata.itemId ?? 'n/a'}</li>
                    <li>metadata.expressId: {sceneObjectSelection.selectedObject.metadata.expressId ?? 'n/a'}</li>
                    <li>
                      highlight policy:{' '}
                      {sceneObjectSelection.selectedObject.metadata.localId === null
                        ? 'model-level fallback'
                        : 'localId-level highlight'}
                    </li>
                  </>
                ) : null}
              </ul>
            ) : null}
          </section>
          <section className="ifc-probe-card" aria-label="Transform state">
            <h3>Transform State (Step 10)</h3>
            <p>
              {sceneObjectTransform.snapshot
                ? '已附加 TransformControls，拖曳後會更新可序列化 transform snapshot。'
                : '目前沒有可變形目標（需先選取 IFC 物件）。'}
            </p>
            <p>Updated at: {sceneObjectTransform.updatedAt ?? '--'}</p>
            <ul>
              <li>mode: {sceneObjectTransform.mode}</li>
              <li>isDragging: {sceneObjectTransform.isDragging ? 'true' : 'false'}</li>
              <li>snapshot target: {sceneObjectTransform.snapshot?.objectRef.objectKey ?? 'none'}</li>
              <li>
                position:{' '}
                {sceneObjectTransform.snapshot
                  ? sceneObjectTransform.snapshot.position.map((value) => value.toFixed(4)).join(', ')
                  : 'n/a'}
              </li>
              <li>
                rotation(rad):{' '}
                {sceneObjectTransform.snapshot
                  ? sceneObjectTransform.snapshot.rotation.map((value) => value.toFixed(4)).join(', ')
                  : 'n/a'}
              </li>
              <li>
                scale:{' '}
                {sceneObjectTransform.snapshot
                  ? sceneObjectTransform.snapshot.scale.map((value) => value.toFixed(4)).join(', ')
                  : 'n/a'}
              </li>
            </ul>
          </section>
          <p>Step 10 已接上 TransformControls；Step 11 會補上 toolbar mode 切換 UI。</p>
        </aside>
      </section>
    </main>
  )
}

export default App
