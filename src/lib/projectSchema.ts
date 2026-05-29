import type {
  ProjectJsonDocument,
  ProjectObjectTransformRecord,
  ProjectSource,
  ProjectTransformVector3,
} from '../types/project'
import { PROJECT_SCHEMA_KIND, PROJECT_SCHEMA_VERSION } from '../types/project'

type UnknownRecord = Record<string, unknown>

const isPlainObject = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isVector3 = (value: unknown): value is ProjectTransformVector3 =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((item) => typeof item === 'number' && Number.isFinite(item))

const isProjectSourceType = (value: unknown): value is ProjectSource['sourceType'] => value === 'ifc' || value === 'glb'

const isProjectSource = (value: unknown): value is ProjectSource => {
  if (!isPlainObject(value)) {
    return false
  }

  if (!isProjectSourceType(value.sourceType) || typeof value.sourceId !== 'string' || typeof value.fileName !== 'string') {
    return false
  }

  if (value.sourceType === 'ifc') {
    return typeof value.modelId === 'string'
  }

  return (
    (typeof value.rootObjectId === 'string' || value.rootObjectId === null) &&
    (typeof value.nodePath === 'string' || value.nodePath === null)
  )
}

const isProjectObjectTransformRecord = (value: unknown): value is ProjectObjectTransformRecord => {
  if (!isPlainObject(value)) {
    return false
  }

  if (!isPlainObject(value.objectRef)) {
    return false
  }

  const { objectRef } = value
  const hasValidObjectRef =
    (objectRef.sourceType === 'ifc' || objectRef.sourceType === 'glb') &&
    typeof objectRef.sourceId === 'string' &&
    typeof objectRef.objectKey === 'string'

  if (!hasValidObjectRef) {
    return false
  }

  return isVector3(value.position) && isVector3(value.rotation) && isVector3(value.scale)
}

// Step 12：先把 project JSON v1 的結構明確固定，後續 save/restore 以 version gate 控制相容性。
export const PROJECT_JSON_SCHEMA_V1 = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'bim-lightweight-viewer/project/v1',
  title: 'BIM Lightweight Viewer Project Schema v1',
  type: 'object',
  required: ['schema', 'version', 'createdAt', 'updatedAt', 'sources', 'objectTransforms'],
  additionalProperties: false,
  properties: {
    schema: { const: PROJECT_SCHEMA_KIND },
    version: { const: PROJECT_SCHEMA_VERSION },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
    sources: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            required: ['sourceType', 'sourceId', 'fileName', 'modelId'],
            additionalProperties: false,
            properties: {
              sourceType: { const: 'ifc' },
              sourceId: { type: 'string' },
              fileName: { type: 'string' },
              modelId: { type: 'string' },
            },
          },
          {
            type: 'object',
            required: ['sourceType', 'sourceId', 'fileName', 'rootObjectId', 'nodePath'],
            additionalProperties: false,
            properties: {
              sourceType: { const: 'glb' },
              sourceId: { type: 'string' },
              fileName: { type: 'string' },
              rootObjectId: { type: ['string', 'null'] },
              nodePath: { type: ['string', 'null'] },
            },
          },
        ],
      },
    },
    objectTransforms: {
      type: 'array',
      items: {
        type: 'object',
        required: ['objectRef', 'position', 'rotation', 'scale'],
        additionalProperties: false,
        properties: {
          objectRef: {
            type: 'object',
            required: ['sourceType', 'sourceId', 'objectKey'],
            additionalProperties: false,
            properties: {
              sourceType: { enum: ['ifc', 'glb'] },
              sourceId: { type: 'string' },
              objectKey: { type: 'string' },
            },
          },
          position: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'number' },
          },
          rotation: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'number' },
          },
          scale: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'number' },
          },
        },
      },
    },
  },
} as const satisfies UnknownRecord

export const createEmptyProjectDocument = (nowIso = new Date().toISOString()): ProjectJsonDocument => ({
  schema: PROJECT_SCHEMA_KIND,
  version: PROJECT_SCHEMA_VERSION,
  createdAt: nowIso,
  updatedAt: nowIso,
  sources: [],
  objectTransforms: [],
})

export const isProjectJsonDocument = (value: unknown): value is ProjectJsonDocument => {
  if (!isPlainObject(value)) {
    return false
  }

  if (value.schema !== PROJECT_SCHEMA_KIND || value.version !== PROJECT_SCHEMA_VERSION) {
    return false
  }

  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') {
    return false
  }

  if (!Array.isArray(value.sources) || !value.sources.every(isProjectSource)) {
    return false
  }

  if (!Array.isArray(value.objectTransforms) || !value.objectTransforms.every(isProjectObjectTransformRecord)) {
    return false
  }

  return true
}

export const getProjectJsonValidationErrors = (value: unknown): string[] => {
  const errors: string[] = []

  if (!isPlainObject(value)) {
    return ['project JSON 必須是 object。']
  }

  if (value.schema !== PROJECT_SCHEMA_KIND) {
    errors.push(`schema 必須是 ${PROJECT_SCHEMA_KIND}。`)
  }

  if (value.version !== PROJECT_SCHEMA_VERSION) {
    errors.push(`version 必須是 ${PROJECT_SCHEMA_VERSION}。`)
  }

  if (typeof value.createdAt !== 'string') {
    errors.push('createdAt 必須是字串。')
  }

  if (typeof value.updatedAt !== 'string') {
    errors.push('updatedAt 必須是字串。')
  }

  if (!Array.isArray(value.sources)) {
    errors.push('sources 必須是陣列。')
  } else if (!value.sources.every(isProjectSource)) {
    errors.push('sources 內含不合法的 source 條目。')
  }

  if (!Array.isArray(value.objectTransforms)) {
    errors.push('objectTransforms 必須是陣列。')
  } else if (!value.objectTransforms.every(isProjectObjectTransformRecord)) {
    errors.push('objectTransforms 內含不合法的 transform 條目。')
  }

  return errors
}
