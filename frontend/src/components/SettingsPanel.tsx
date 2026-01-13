import './SettingsPanel.css'

export type ThemeMode = 'light' | 'dark' | 'iluvatar'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  zoomSensitivity: number
  onZoomSensitivityChange: (value: number) => void
  theme: ThemeMode
  onThemeChange: (value: ThemeMode) => void
}

export default function SettingsPanel({
  isOpen,
  onClose,
  zoomSensitivity,
  onZoomSensitivityChange,
  theme,
  onThemeChange,
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
          {/* Theme Selector */}
          <div className="settings-section">
            <label className="settings-label">
              <span>Theme</span>
            </label>
            <div className="theme-options">
              <button
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => onThemeChange('light')}
              >
                Light
              </button>
              <button
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => onThemeChange('dark')}
              >
                Dark
              </button>
              <button
                className={`theme-btn iluvatar ${theme === 'iluvatar' ? 'active' : ''}`}
                onClick={() => onThemeChange('iluvatar')}
              >
                Iluvatar
              </button>
            </div>
            <div className="settings-hint">
              Choose a color theme for the interface
            </div>
          </div>

          {/* Zoom Sensitivity */}
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
