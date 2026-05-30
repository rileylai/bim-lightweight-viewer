import { useCallback, useEffect, useRef, useState } from 'react'
import GlbUploadControl from './components/GlbUploadControl'
import IfcUploadControl from './components/IfcUploadControl'
import ProjectJsonOpenControl from './components/ProjectJsonOpenControl'
import TransformModeToolbar from './components/TransformModeToolbar'
import ViewerCanvas from './components/ViewerCanvas'
import { loadGlbRuntimeModel } from './lib/gltfLoaderRuntime'
import { clearIfcRuntimeSelectionHighlight, loadIfcRuntimeModel, setIfcRuntimeSelectionHighlight } from './lib/ifcLoaderRuntime'
import {
  cloneProjectTransformRecord,
  createProjectDownloadFileName,
  downloadProjectJsonDocument,
  restoreIfcModelTransformFromProject,
  serializeProjectDocument,
  upsertProjectTransformRecord,
} from './lib/projectPersistence'
import { getProjectJsonValidationErrors } from './lib/projectSchema'
import { createNextSelectionState } from './lib/sceneObjectIdentity'
import type { GlbRuntimeModel, GlbUploadState } from './types/glb'
import type {
  IfcLoadProcess,
  IfcLoadProcessState,
  IfcLoadProgressState,
  IfcRaycastProbeResult,
  IfcRuntimeModel,
  IfcUploadState,
} from './types/ifc'
import type { ProjectJsonDocument, ProjectObjectTransformRecord } from './types/project'
import type {
  SceneObjectIdentity,
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

const initialGlbUploadState: GlbUploadState = {
  file: null,
  status: 'idle',
  message: '尚未選擇 GLB/GLTF 檔案。',
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

interface ProjectSaveState {
  status: 'idle' | 'saved' | 'error'
  message: string
  downloadedFileName: string | null
  updatedAt: string | null
}

const initialProjectSaveState: ProjectSaveState = {
  status: 'idle',
  message: '尚未下載 project JSON。',
  downloadedFileName: null,
  updatedAt: null,
}

interface ProjectOpenState {
  status: 'idle' | 'restored' | 'error'
  message: string
  openedFileName: string | null
  matchedTransformCount: number
  skippedTransformCount: number
  appliedObjectKey: string | null
  updatedAt: string | null
}

const initialProjectOpenState: ProjectOpenState = {
  status: 'idle',
  message: '尚未開啟 project JSON。',
  openedFileName: null,
  matchedTransformCount: 0,
  skippedTransformCount: 0,
  appliedObjectKey: null,
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

const DEBUG_GLB_HIGHLIGHT = false

const debugGlbHighlightLog = (label: string, payload: unknown) => {
  if (!DEBUG_GLB_HIGHLIGHT) {
    return
  }

  console.log(label, payload)
}

const isTextEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
}

function App() {
  const [orbitControlsEnabled, setOrbitControlsEnabled] = useState(true)
  const [ifcUploadState, setIfcUploadState] = useState<IfcUploadState>(initialIfcUploadState)
  const [glbUploadState, setGlbUploadState] = useState<GlbUploadState>(initialGlbUploadState)
  const [ifcLoadProgress, setIfcLoadProgress] = useState<IfcLoadProgressState>(initialIfcLoadProgressState)
  const [ifcRuntimeModel, setIfcRuntimeModel] = useState<IfcRuntimeModel | null>(null)
  const [glbRuntimeModels, setGlbRuntimeModels] = useState<GlbRuntimeModel[]>([])
  const [ifcRaycastProbe, setIfcRaycastProbe] = useState<IfcRaycastProbeResult>(initialIfcRaycastProbeState)
  const [sceneObjectSelection, setSceneObjectSelection] = useState<SceneObjectSelectionState>(initialSceneObjectSelectionState)
  const [sceneObjectTransform, setSceneObjectTransform] = useState<SceneObjectTransformState>(
    initialSceneObjectTransformState,
  )
  const [projectTransformRecords, setProjectTransformRecords] = useState<ProjectObjectTransformRecord[]>([])
  const [projectSaveState, setProjectSaveState] = useState<ProjectSaveState>(initialProjectSaveState)
  const [projectOpenState, setProjectOpenState] = useState<ProjectOpenState>(initialProjectOpenState)
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
    if (snapshot && snapshot.objectRef.sourceType === 'ifc') {
      // Step 17：GLB transform 先落地在 runtime 互動；project JSON 寫入仍維持 IFC-only，待 Step 19 再擴充。
      setProjectTransformRecords((previousRecords) => upsertProjectTransformRecord(previousRecords, snapshot))
    }

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

  const resetTransformState = (options?: {
    clearTransformRecords?: boolean
    clearProjectSaveState?: boolean
    clearProjectOpenState?: boolean
  }) => {
    setOrbitControlsEnabled(true)
    setSceneObjectTransform(initialSceneObjectTransformState)

    if (options?.clearTransformRecords) {
      setProjectTransformRecords([])
    }

    if (options?.clearProjectSaveState) {
      setProjectSaveState(initialProjectSaveState)
    }

    if (options?.clearProjectOpenState) {
      setProjectOpenState(initialProjectOpenState)
    }
  }

  const hasTransformTarget = sceneObjectSelection.selectedObject !== null

  const handleSaveProjectJson = useCallback(() => {
    if (!ifcRuntimeModel) {
      setProjectSaveState({
        status: 'error',
        message: '尚未載入 IFC 模型，無法儲存 project JSON。',
        downloadedFileName: null,
        updatedAt: new Date().toISOString(),
      })
      return
    }

    const nowIso = new Date().toISOString()
    const projectDocument = serializeProjectDocument({
      ifcModel: ifcRuntimeModel,
      transformRecords: projectTransformRecords,
      nowIso,
    })
    const validationErrors = getProjectJsonValidationErrors(projectDocument)

    if (validationErrors.length > 0) {
      setProjectSaveState({
        status: 'error',
        message: `project JSON 驗證失敗：${validationErrors.join('；')}`,
        downloadedFileName: null,
        updatedAt: nowIso,
      })
      return
    }

    const fileNameBase = ifcUploadState.file?.name ?? ifcRuntimeModel.fileName ?? ifcRuntimeModel.modelId
    const downloadFileName = createProjectDownloadFileName(fileNameBase)
    downloadProjectJsonDocument(projectDocument, downloadFileName)

    setProjectSaveState({
      status: 'saved',
      message: `project JSON 已下載（sources: ${projectDocument.sources.length}，transforms: ${projectDocument.objectTransforms.length}）。`,
      downloadedFileName: downloadFileName,
      updatedAt: nowIso,
    })
  }, [ifcRuntimeModel, ifcUploadState.file, projectTransformRecords])

  useEffect(() => {
    const handleProjectQuickSave = (event: KeyboardEvent) => {
      const hasSaveShortcutModifier = event.metaKey || event.ctrlKey
      const isSaveKey = event.key.toLowerCase() === 's'
      if (!hasSaveShortcutModifier || !isSaveKey) {
        return
      }

      // Step 15：阻止瀏覽器原生另存視窗，改走 app 既有 project JSON save 流程。
      event.preventDefault()

      if (event.repeat || event.altKey || event.shiftKey || isTextEditableTarget(event.target)) {
        return
      }

      handleSaveProjectJson()
    }

    window.addEventListener('keydown', handleProjectQuickSave)
    return () => {
      window.removeEventListener('keydown', handleProjectQuickSave)
    }
  }, [handleSaveProjectJson])

  const syncTransformSnapshotFromRestore = (appliedTransform: ProjectObjectTransformRecord, nowIso: string) => {
    setSceneObjectTransform((previousTransformState) => {
      const previousSnapshot = previousTransformState.snapshot
      if (
        !previousSnapshot ||
        previousSnapshot.objectRef.sourceType !== 'ifc' ||
        previousSnapshot.objectRef.sourceId !== appliedTransform.objectRef.sourceId
      ) {
        return previousTransformState
      }

      return {
        ...previousTransformState,
        snapshot: {
          ...previousSnapshot,
          position: [...appliedTransform.position],
          rotation: [...appliedTransform.rotation],
          scale: [...appliedTransform.scale],
        },
        updatedAt: nowIso,
      }
    })
  }

  const handleSelectProjectJsonFile = async (file: File | null) => {
    if (!file) {
      return
    }

    const nowIso = new Date().toISOString()
    const isJsonFile = file.name.toLowerCase().endsWith('.json')
    if (!isJsonFile) {
      setProjectOpenState({
        status: 'error',
        message: '檔案格式錯誤：請選擇 .json 的 project 檔案。',
        openedFileName: file.name,
        matchedTransformCount: 0,
        skippedTransformCount: 0,
        appliedObjectKey: null,
        updatedAt: nowIso,
      })
      return
    }

    let parsedProjectDocument: unknown

    try {
      const rawText = await file.text()
      parsedProjectDocument = JSON.parse(rawText)
    } catch (error) {
      setProjectOpenState({
        status: 'error',
        message: `讀取 project JSON 失敗：${toErrorMessage(error)}`,
        openedFileName: file.name,
        matchedTransformCount: 0,
        skippedTransformCount: 0,
        appliedObjectKey: null,
        updatedAt: nowIso,
      })
      return
    }

    const validationErrors = getProjectJsonValidationErrors(parsedProjectDocument)
    if (validationErrors.length > 0) {
      setProjectOpenState({
        status: 'error',
        message: `project JSON 驗證失敗：${validationErrors.join('；')}`,
        openedFileName: file.name,
        matchedTransformCount: 0,
        skippedTransformCount: 0,
        appliedObjectKey: null,
        updatedAt: nowIso,
      })
      return
    }

    const projectDocument = parsedProjectDocument as ProjectJsonDocument

    if (!ifcRuntimeModel) {
      setProjectOpenState({
        status: 'error',
        message: '請先使用 IFC Upload 載入對應模型，再開啟 project JSON 還原 transform。',
        openedFileName: file.name,
        matchedTransformCount: 0,
        skippedTransformCount: 0,
        appliedObjectKey: null,
        updatedAt: nowIso,
      })
      return
    }

    const restoreResult = restoreIfcModelTransformFromProject(ifcRuntimeModel, projectDocument)
    if (!restoreResult.appliedTransform) {
      const mismatchHint = restoreResult.matchedSource
        ? 'project JSON 內沒有可套用到目前 IFC 的 transform 記錄。'
        : 'project JSON 找不到可對應目前 IFC 的 source（sourceId/fileName）。'

      setProjectOpenState({
        status: 'error',
        message: `還原失敗：${mismatchHint}`,
        openedFileName: file.name,
        matchedTransformCount: restoreResult.matchedTransformCount,
        skippedTransformCount: restoreResult.skippedTransformCount,
        appliedObjectKey: null,
        updatedAt: nowIso,
      })
      return
    }

    setProjectTransformRecords(projectDocument.objectTransforms.map((record) => cloneProjectTransformRecord(record)))
    syncTransformSnapshotFromRestore(restoreResult.appliedTransform, nowIso)
    const restoreByFileNameNotice =
      restoreResult.sourceMatchStrategy === 'fileName'
        ? 'sourceId 不一致，已以 fileName 對應成功。'
        : ''
    setProjectOpenState({
      status: 'restored',
      message:
        restoreResult.skippedTransformCount > 0
          ? `project JSON 已還原（匹配 ${restoreResult.matchedTransformCount} 筆，依 Step 10 model-root fallback 套用最新 1 筆）。${restoreByFileNameNotice}`
          : `project JSON 已還原（套用 ${restoreResult.appliedTransform.objectRef.objectKey}）。${restoreByFileNameNotice}`,
      openedFileName: file.name,
      matchedTransformCount: restoreResult.matchedTransformCount,
      skippedTransformCount: restoreResult.skippedTransformCount,
      appliedObjectKey: restoreResult.appliedTransform.objectRef.objectKey,
      updatedAt: nowIso,
    })
  }

  const handleSelectGlbFile = async (file: File | null) => {
    if (!file) {
      return
    }

    const fileNameLowerCase = file.name.toLowerCase()
    const isSupportedGlbFile = fileNameLowerCase.endsWith('.glb') || fileNameLowerCase.endsWith('.gltf')
    if (!isSupportedGlbFile) {
      setGlbUploadState({
        file,
        status: 'invalid',
        message: '檔案格式錯誤：請選擇 .glb 或 .gltf 檔案。',
      })
      return
    }

    setGlbUploadState({
      file,
      status: 'loading',
      message: `GLB/GLTF 載入中：${file.name}`,
    })

    try {
      const loadedGlbModel = await loadGlbRuntimeModel(file)
      const nextLoadedCount = glbRuntimeModels.length + 1

      setGlbRuntimeModels((previousModels) => [...previousModels, loadedGlbModel])
      setGlbUploadState({
        file,
        status: 'loaded',
        message: `GLB/GLTF 載入完成：${loadedGlbModel.fileName}（scene 內共 ${nextLoadedCount} 個 GLB/GLTF）。`,
      })
    } catch (error) {
      setGlbUploadState({
        file,
        status: 'error',
        message: toErrorMessage(error),
      })
    }
  }

  const handleSceneSelectionChange = ({
    selectedObject,
    ifcProbeResult,
  }: {
    selectedObject: SceneObjectIdentity | null
    ifcProbeResult: IfcRaycastProbeResult | null
  }) => {
    const matchedGlbSource =
      selectedObject?.sourceType === 'glb'
        ? glbRuntimeModels.find((model) => model.sourceId === selectedObject.sourceId) ?? null
        : null

    debugGlbHighlightLog('[SceneSelectionDebug] selection change', {
      selectedSourceType: selectedObject?.sourceType ?? null,
      selectedSourceId: selectedObject?.sourceId ?? null,
      selectedIdentityId: selectedObject?.identityId ?? null,
      matchedGlbSourceId: matchedGlbSource?.sourceId ?? null,
      matchedGlbRootObjectId: matchedGlbSource?.rootObjectId ?? null,
      ifcProbeStatus: ifcProbeResult?.status ?? null,
    })

    if (ifcProbeResult) {
      setIfcRaycastProbe(ifcProbeResult)
    } else if (!ifcRuntimeModel) {
      setIfcRaycastProbe(initialIfcRaycastProbeState)
    }

    setSceneObjectSelection((previousSelection) => createNextSelectionState(previousSelection, selectedObject))

    void syncSelectedHighlight(selectedObject).catch((error: unknown) => {
      console.warn('[IfcSelection] highlight update failed', error)
    })

    if (!selectedObject) {
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
      resetTransformState({
        clearTransformRecords: true,
        clearProjectSaveState: true,
        clearProjectOpenState: true,
      })
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
    resetTransformState({
      clearTransformRecords: true,
      clearProjectSaveState: true,
      clearProjectOpenState: true,
    })
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
      resetTransformState({
        clearTransformRecords: true,
        clearProjectSaveState: true,
        clearProjectOpenState: true,
      })
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
      resetTransformState({
        clearTransformRecords: true,
        clearProjectSaveState: true,
        clearProjectOpenState: true,
      })
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
          <GlbUploadControl uploadState={glbUploadState} onSelectGlbFile={handleSelectGlbFile} />
          <ProjectJsonOpenControl onSelectProjectJsonFile={handleSelectProjectJsonFile} />
          <TransformModeToolbar
            mode={sceneObjectTransform.mode}
            disabled={!hasTransformTarget}
            onModeChange={updateTransformMode}
          />
          <button type="button" disabled={!ifcRuntimeModel} onClick={handleSaveProjectJson}>
            Save Project JSON
          </button>
          <span className="status-pill">Step 17</span>
        </div>
      </header>

      <section className="workspace-layout">
        <section className="viewer-panel" aria-label="3D viewer area">
          <div className="viewer-head">
            <h2>3D Viewer</h2>
            <p>OrbitControls：左鍵旋轉、右鍵平移、滾輪縮放；Transform mode 可由 toolbar 或 W/E/R 快捷鍵切換。</p>
          </div>
          <div className="viewer-canvas-wrapper">
            <ViewerCanvas
              orbitEnabled={orbitControlsEnabled}
              ifcModel={ifcRuntimeModel}
              glbModels={glbRuntimeModels}
              selectedObject={sceneObjectSelection.selectedObject}
              transformMode={sceneObjectTransform.mode}
              onSceneSelectionChange={handleSceneSelectionChange}
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
            <li>GLB/GLTF status: {glbUploadState.status}</li>
            <li>GLB/GLTF models: {glbRuntimeModels.length}</li>
            <li>IFC probe status: {ifcRaycastProbe.status}</li>
            <li>Selected identity: {sceneObjectSelection.selectedObject?.identityId ?? 'none'}</li>
            <li>Transform mode: {sceneObjectTransform.mode}</li>
            <li>Transform dragging: {sceneObjectTransform.isDragging ? 'yes' : 'no'}</li>
            <li>Transform records: {projectTransformRecords.length}</li>
            <li>Orbit controls: {orbitControlsEnabled ? 'enabled' : 'disabled while transforming'}</li>
            <li>Project open status: {projectOpenState.status}</li>
          </ul>
          <p className={`ifc-state-message is-${ifcUploadState.status}`}>{ifcUploadState.message}</p>
          <p className={`ifc-state-message is-${glbUploadState.status}`}>{glbUploadState.message}</p>
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
                ) : (
                  <>
                    <li>transform target: GLB root object（Step 17 root-level）</li>
                    <li>metadata.rootObjectId: {sceneObjectSelection.selectedObject.metadata.rootObjectId ?? 'n/a'}</li>
                    <li>metadata.nodePath: {sceneObjectSelection.selectedObject.metadata.nodePath ?? 'n/a'}</li>
                    <li>highlight policy: GLB dual-layer overlay highlight（fill + edge）</li>
                  </>
                )}
              </ul>
            ) : null}
          </section>
          <section className="ifc-probe-card" aria-label="Transform state">
            <h3>Transform State (Step 10)</h3>
            <p>
              {sceneObjectTransform.snapshot
                ? '已附加 TransformControls，拖曳後會更新可序列化 transform snapshot。'
                : '目前沒有可變形目標（需先選取 IFC 或 GLB 物件）。'}
            </p>
            <p>Updated at: {sceneObjectTransform.updatedAt ?? '--'}</p>
            <ul>
              <li>mode: {sceneObjectTransform.mode}</li>
              <li>isDragging: {sceneObjectTransform.isDragging ? 'true' : 'false'}</li>
              <li>toolbar enabled: {hasTransformTarget ? 'true' : 'false (請先選取 IFC 或 GLB 物件)'}</li>
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
          <section className={`ifc-probe-card is-${projectSaveState.status}`} aria-label="Project save state">
            <h3>Project Save State (Step 13)</h3>
            <p>{projectSaveState.message}</p>
            <ul>
              <li>status: {projectSaveState.status}</li>
              <li>downloaded file: {projectSaveState.downloadedFileName ?? 'none'}</li>
              <li>updated at: {projectSaveState.updatedAt ?? '--'}</li>
            </ul>
          </section>
          <section className={`ifc-probe-card is-${projectOpenState.status}`} aria-label="Project open state">
            <h3>Project Open State (Step 14)</h3>
            <p>{projectOpenState.message}</p>
            <ul>
              <li>status: {projectOpenState.status}</li>
              <li>opened file: {projectOpenState.openedFileName ?? 'none'}</li>
              <li>matched transforms: {projectOpenState.matchedTransformCount}</li>
              <li>skipped transforms: {projectOpenState.skippedTransformCount}</li>
              <li>applied object key: {projectOpenState.appliedObjectKey ?? 'none'}</li>
              <li>updated at: {projectOpenState.updatedAt ?? '--'}</li>
            </ul>
          </section>
          <section className={`ifc-probe-card is-${glbUploadState.status}`} aria-label="GLB/GLTF upload state">
            <h3>GLB/GLTF Upload State (Step 16)</h3>
            <p>{glbUploadState.message}</p>
            <ul>
              <li>status: {glbUploadState.status}</li>
              <li>file: {glbUploadState.file?.name ?? 'none'}</li>
              <li>loaded models: {glbRuntimeModels.length}</li>
              <li>
                latest source: {glbRuntimeModels.length > 0 ? `${glbRuntimeModels[glbRuntimeModels.length - 1].sourceType}:${glbRuntimeModels[glbRuntimeModels.length - 1].sourceId}` : 'none'}
              </li>
            </ul>
          </section>
          <p>Step 17 已支援 GLB selection 與 transform，IFC/GLB 可在同一 scene 交替操作。</p>
        </aside>
      </section>
    </main>
  )
}

export default App
