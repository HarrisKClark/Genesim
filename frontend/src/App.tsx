import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import Layout from './components/Layout'
import './App.css'

function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <Layout />
    </DndProvider>
  )
}

export default App


