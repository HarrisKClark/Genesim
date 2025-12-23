import './Header.css'

interface HeaderProps {
  onSettingsClick: () => void
  onNewCircuit: () => void
  onLoadCircuit: () => void
  onSaveCircuit: () => void
}

export default function Header({ onSettingsClick, onNewCircuit, onLoadCircuit, onSaveCircuit }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">Genesim</h1>
        <p className="header-subtitle">Genetic Circuit Simulator</p>
      </div>
      <div className="header-actions">
        <button className="btn btn-secondary" onClick={onNewCircuit}>New Circuit</button>
        <button className="btn btn-secondary" onClick={onLoadCircuit}>Load</button>
        <button className="btn btn-secondary" onClick={onSaveCircuit}>Save</button>
        <button className="btn btn-secondary" onClick={onSettingsClick} title="Settings">
          ⚙
        </button>
      </div>
    </header>
  )
}


