import './SettingsPanel.css'
import './SettingsPanel.css'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  zoomSensitivity: number
  onZoomSensitivityChange: (value: number) => void
}

export default function SettingsPanel({
  isOpen,
  onClose,
  zoomSensitivity,
  onZoomSensitivityChange,
}: SettingsPanelProps) {
  if (!isOpen) return null

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose}>×</button>
        </div>
        <div className="settings-content">
          <div className="settings-section">
            <label className="settings-label">
              <span>Zoom Sensitivity</span>
              <span className="settings-value">{zoomSensitivity.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={zoomSensitivity}
              onChange={(e) => onZoomSensitivityChange(parseFloat(e.target.value))}
              className="settings-slider"
            />
            <div className="settings-hint">
              Controls how fast zoom changes when scrolling (0.1 = slow, 2 = fast)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

