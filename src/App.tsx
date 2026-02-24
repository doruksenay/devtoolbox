import { useApp } from './context/AppContext'
import { TabBar } from './components/Layout/TabBar'
import { Header } from './components/Layout/Header'
import { EditorTab } from './components/Editor/EditorTab'
import { CompareTab } from './components/Compare/CompareTab'
import { GridTab } from './components/Grid/GridTab'
import { QueryTab } from './components/Query/QueryTab'

export default function App() {
  const { state } = useApp()

  return (
    <div className="app-shell">
      <Header />
      <TabBar />
      <div className="tab-content">
        {state.activeTab === 'editor'  && <EditorTab />}
        {state.activeTab === 'compare' && <CompareTab />}
        {state.activeTab === 'grid'    && <GridTab />}
        {state.activeTab === 'query'   && <QueryTab />}
      </div>
    </div>
  )
}
