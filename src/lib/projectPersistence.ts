import type { IfcRuntimeModel } from '../types/ifc'
import type {
  ProjectIfcSource,
  ProjectJsonDocument,
  ProjectObjectTransformRecord,
  ProjectSource,
} from '../types/project'
import type { SceneObjectIdentityReference, SceneObjectTransformSnapshot } from '../types/sceneObjectIdentity'
import { createEmptyProjectDocument } from './projectSchema'

const buildObjectRefKey = (objectRef: SceneObjectIdentityReference) =>
  `${objectRef.sourceType}:${objectRef.sourceId}:${objectRef.objectKey}`

const toIfcProjectSource = (ifcModel: IfcRuntimeModel): ProjectIfcSource => ({
  sourceType: 'ifc',
  sourceId: ifcModel.modelId,
  fileName: ifcModel.fileName,
  modelId: ifcModel.modelId,
})

const cloneTransformRecord = (
  input: SceneObjectTransformSnapshot | ProjectObjectTransformRecord,
): ProjectObjectTransformRecord => ({
  objectRef: {
    sourceType: input.objectRef.sourceType,
    sourceId: input.objectRef.sourceId,
    objectKey: input.objectRef.objectKey,
  },
  position: [...input.position] as ProjectObjectTransformRecord['position'],
  rotation: [...input.rotation] as ProjectObjectTransformRecord['rotation'],
  scale: [...input.scale] as ProjectObjectTransformRecord['scale'],
})

export const upsertProjectTransformRecord = (
  previousRecords: ProjectObjectTransformRecord[],
  nextRecord: SceneObjectTransformSnapshot | ProjectObjectTransformRecord,
): ProjectObjectTransformRecord[] => {
  const nextRecordCopy = cloneTransformRecord(nextRecord)
  const nextObjectRefKey = buildObjectRefKey(nextRecordCopy.objectRef)
  const targetIndex = previousRecords.findIndex((record) => buildObjectRefKey(record.objectRef) === nextObjectRefKey)

  if (targetIndex === -1) {
    return [...previousRecords, nextRecordCopy]
  }

  const targetRecord = previousRecords[targetIndex]
  const isSameRecord =
    targetRecord.position.every((value, index) => value === nextRecordCopy.position[index]) &&
    targetRecord.rotation.every((value, index) => value === nextRecordCopy.rotation[index]) &&
    targetRecord.scale.every((value, index) => value === nextRecordCopy.scale[index])

  if (isSameRecord) {
    return previousRecords
  }

  const nextRecords = [...previousRecords]
  nextRecords[targetIndex] = nextRecordCopy
  return nextRecords
}

export const buildProjectSources = (ifcModel: IfcRuntimeModel | null): ProjectSource[] => {
  if (!ifcModel) {
    return []
  }

  return [toIfcProjectSource(ifcModel)]
}

interface SerializeProjectDocumentInput {
  ifcModel: IfcRuntimeModel
  transformRecords: ProjectObjectTransformRecord[]
  nowIso?: string
}

export const serializeProjectDocument = ({
  ifcModel,
  transformRecords,
  nowIso = new Date().toISOString(),
}: SerializeProjectDocumentInput): ProjectJsonDocument => {
  const projectDocument = createEmptyProjectDocument(nowIso)

  projectDocument.sources = buildProjectSources(ifcModel)
  projectDocument.objectTransforms = transformRecords.map((record) => cloneTransformRecord(record))
  projectDocument.updatedAt = nowIso

  return projectDocument
}

export const createProjectDownloadFileName = (baseName: string, now = new Date()) => {
  const sanitizedBaseName = baseName
    .trim()
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const safeBaseName = sanitizedBaseName || 'project'
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  const sec = String(now.getSeconds()).padStart(2, '0')

  return `${safeBaseName}-project-${yyyy}${mm}${dd}-${hh}${min}${sec}.json`
}

export const downloadProjectJsonDocument = (projectDocument: ProjectJsonDocument, fileName: string) => {
  const blob = new Blob([JSON.stringify(projectDocument, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 0)
}
