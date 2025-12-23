import { useState } from 'react'
import ComponentLibrary from './ComponentLibrary'
import './Sidebar.css'

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<'components' | 'properties'>('components')

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button 
          className={`sidebar-tab ${activeTab === 'components' ? 'active' : ''}`}
          onClick={() => setActiveTab('components')}
        >
          Components
        </button>
        <button 
          className={`sidebar-tab ${activeTab === 'properties' ? 'active' : ''}`}
          onClick={() => setActiveTab('properties')}
        >
          Properties
        </button>
      </div>
      <div className="sidebar-content">
        {activeTab === 'components' && <ComponentLibrary />}
        {activeTab === 'properties' && (
          <div className="properties-panel">
            <p className="empty-state">Select a component to edit properties</p>
          </div>
        )}
      </div>
    </aside>
  )
}


