import { useApp } from './context/AppContext'
import { TabBar } from './components/Layout/TabBar'
import { Header } from './components/Layout/Header'
import { EditorTab } from './components/Editor/EditorTab'
import { CompareTab } from './components/Compare/CompareTab'
import { XmlTab } from './components/Xml/XmlTab'
import { GridTab } from './components/Grid/GridTab'
import { QueryTab } from './components/Query/QueryTab'
import { ConvertTab } from './components/Convert/ConvertTab'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useLiveValidation } from './hooks/useLiveValidation'
import { useUrlState } from './hooks/useUrlState'
import { useUndoRedo } from './hooks/useUndoRedo'

export default function App() {
  const { state } = useApp()

  useKeyboardShortcuts()
  useLiveValidation()
  useUrlState()
  useUndoRedo()

  return (
    <div className="app-shell">
      <Header />
      <TabBar />
      <div className="tab-content">
        {state.activeTab === 'editor'  && <EditorTab />}
        {state.activeTab === 'compare' && <CompareTab />}
        {state.activeTab === 'xml'     && <XmlTab />}
        {state.activeTab === 'grid'    && <GridTab />}
        {state.activeTab === 'query'   && <QueryTab />}
        {state.activeTab === 'convert' && <ConvertTab />}
      </div>
    </div>
  )
}
