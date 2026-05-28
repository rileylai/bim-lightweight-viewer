import type { SceneObjectTransformMode } from '../types/sceneObjectIdentity'

interface TransformModeToolbarProps {
  mode: SceneObjectTransformMode
  disabled?: boolean
  onModeChange: (mode: SceneObjectTransformMode) => void
}

const transformModes: Array<{ mode: SceneObjectTransformMode; label: string; shortcut: string }> = [
  { mode: 'translate', label: 'Move', shortcut: 'W' },
  { mode: 'rotate', label: 'Rotate', shortcut: 'E' },
  { mode: 'scale', label: 'Scale', shortcut: 'R' },
]

function TransformModeToolbar({ mode, disabled = false, onModeChange }: TransformModeToolbarProps) {
  return (
    <div className="transform-mode-toolbar" role="group" aria-label="Transform mode toolbar">
      {transformModes.map((item) => {
        const isActive = mode === item.mode

        return (
          <button
            key={item.mode}
            type="button"
            className="transform-mode-button"
            data-active={isActive}
            disabled={disabled}
            onClick={() => {
              onModeChange(item.mode)
            }}
          >
            {item.label} ({item.shortcut})
          </button>
        )
      })}
    </div>
  )
}

export default TransformModeToolbar
