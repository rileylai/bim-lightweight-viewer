import { Box3, MathUtils, OrthographicCamera, PerspectiveCamera, Sphere, Vector3 } from 'three'
import type { Camera, Object3D } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface FitCameraToObjectOptions {
  controls?: OrbitControlsImpl | null
  padding?: number
}

const DEFAULT_PADDING = 1.6
const MIN_BOUNDING_RADIUS = 0.2
const MIN_CAMERA_NEAR = 0.01

const getViewDirection = (
  camera: Camera,
  controls: OrbitControlsImpl | null | undefined,
  modelCenter: Vector3,
) => {
  const baseTarget = controls?.target ?? modelCenter
  const direction = camera.position.clone().sub(baseTarget)

  if (direction.lengthSq() < 1e-6) {
    direction.set(1, 0.7, 1)
  }

  return direction.normalize()
}

const getPerspectiveCameraDistance = (
  camera: PerspectiveCamera,
  radius: number,
  objectSize: Vector3,
  padding: number,
) => {
  const verticalFov = MathUtils.degToRad(camera.fov)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect)

  const fitHeightDistance = (objectSize.y * 0.5) / Math.tan(verticalFov / 2)
  const fitWidthDistance = (objectSize.x * 0.5) / Math.tan(horizontalFov / 2)
  const fitSphereDistance = radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2)

  return Math.max(fitHeightDistance, fitWidthDistance, fitSphereDistance) * padding
}

export const fitCameraToObject = (
  camera: Camera,
  targetObject: Object3D,
  options: FitCameraToObjectOptions = {},
) => {
  if (!(camera instanceof PerspectiveCamera) && !(camera instanceof OrthographicCamera)) {
    console.warn('[CameraFit] unsupported camera type', {
      cameraType: camera.type,
    })
    return false
  }

  const fittingCamera: PerspectiveCamera | OrthographicCamera = camera
  // IFC fragments 可能在上一個 frame 才完成掛載，先強制更新 world matrix 再計算 bounds。
  targetObject.updateWorldMatrix(true, true)
  const bounds = new Box3().setFromObject(targetObject)
  if (bounds.isEmpty()) {
    console.warn('[CameraFit] empty bounding box, skip fit')
    return false
  }

  const objectSize = bounds.getSize(new Vector3())
  const sphere = bounds.getBoundingSphere(new Sphere())
  const modelCenter = sphere.center.clone()
  const hasInvalidRadius = !Number.isFinite(sphere.radius) || sphere.radius <= 0
  if (hasInvalidRadius) {
    console.warn('[CameraFit] invalid sphere radius, fallback to minimum radius', {
      sphereRadius: sphere.radius,
    })
  }
  const modelRadius = hasInvalidRadius ? MIN_BOUNDING_RADIUS : Math.max(sphere.radius, MIN_BOUNDING_RADIUS)
  const fitPadding = options.padding && options.padding > 0 ? options.padding : DEFAULT_PADDING
  const controls = options.controls
  const direction = getViewDirection(fittingCamera, controls, modelCenter)

  let distance = modelRadius * fitPadding * 2.5

  if (fittingCamera instanceof PerspectiveCamera) {
    distance = getPerspectiveCameraDistance(fittingCamera, modelRadius, objectSize, fitPadding)
  }

  if (fittingCamera instanceof OrthographicCamera) {
    const paddedWidth = Math.max(objectSize.x * fitPadding, MIN_BOUNDING_RADIUS * 2)
    const paddedHeight = Math.max(objectSize.y * fitPadding, MIN_BOUNDING_RADIUS * 2)
    const frustumWidth = Math.abs(fittingCamera.right - fittingCamera.left)
    const frustumHeight = Math.abs(fittingCamera.top - fittingCamera.bottom)
    const zoomFromWidth = frustumWidth / paddedWidth
    const zoomFromHeight = frustumHeight / paddedHeight

    fittingCamera.zoom = Math.max(Math.min(zoomFromWidth, zoomFromHeight), 0.01)
    fittingCamera.updateProjectionMatrix()
    distance = Math.max(objectSize.z * fitPadding * 1.8, modelRadius * 3)
  }

  if (!Number.isFinite(distance) || distance <= 0) {
    console.warn('[CameraFit] invalid fit distance, skip fit', {
      distance,
    })
    return false
  }

  fittingCamera.position.copy(modelCenter).addScaledVector(direction, distance)
  fittingCamera.near = Math.max(MIN_CAMERA_NEAR, distance - modelRadius * 6)
  fittingCamera.far = Math.max(distance + modelRadius * 12, fittingCamera.near + 1)
  fittingCamera.lookAt(modelCenter)
  fittingCamera.updateProjectionMatrix()

  if (controls) {
    // 同步 OrbitControls target 與縮放範圍，讓模型尺度改變時仍保有合理操作距離。
    controls.target.copy(modelCenter)
    controls.minDistance = Math.max(modelRadius * 0.08, 0.25)
    controls.maxDistance = Math.max(modelRadius * 40, controls.minDistance + 10)
    controls.update()
  }

  return true
}
