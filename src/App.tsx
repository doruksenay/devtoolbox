import { useApp } from './context/AppContext'
import { Sidebar } from './components/Sidebar/Sidebar'
import { Header } from './components/Layout/Header'
import { EditorTab } from './components/Editor/EditorTab'
import { CompareTab } from './components/Compare/CompareTab'
import { XmlTab } from './components/Xml/XmlTab'
import { XmlCompareTab } from './components/XmlCompare/XmlCompareTab'
import { GridTab } from './components/Grid/GridTab'
import { QueryTab } from './components/Query/QueryTab'
import { ConvertTab } from './components/Convert/ConvertTab'
import { HarTab } from './components/Har/HarTab'
import { CronTab } from './components/Cron/CronTab'
import { JwtTab } from './components/Jwt/JwtTab'
import { DrawTab } from './components/Draw/DrawTab'
import { YamlTab } from './components/Yaml/YamlTab'
import { Base64Tab } from './components/Base64/Base64Tab'
import { UrlTab } from './components/UrlEnc/UrlTab'
import { SoapTab } from './components/Soap/SoapTab'
import { CleanTab } from './components/Clean/CleanTab'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
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
      <div className="app-shell__main">
        <Sidebar />
        <div className="tab-content">
          {state.activeTab === 'editor'  && <EditorTab />}
          {state.activeTab === 'compare' && <CompareTab />}
          {state.activeTab === 'xml'        && <XmlTab />}
          {state.activeTab === 'xmlcompare' && <XmlCompareTab />}
          {state.activeTab === 'grid'    && <GridTab />}
          {state.activeTab === 'query'   && <QueryTab />}
          {state.activeTab === 'convert' && <ConvertTab />}
          {state.activeTab === 'har'     && <HarTab />}
          {state.activeTab === 'cron'    && <CronTab />}
          {state.activeTab === 'jwt'     && <JwtTab />}
          {state.activeTab === 'draw'    && <DrawTab />}
          {state.activeTab === 'yaml'    && <YamlTab />}
          {state.activeTab === 'base64'  && <Base64Tab />}
          {state.activeTab === 'urlenc'  && <UrlTab />}
          {state.activeTab === 'soap'    && <SoapTab />}
          {state.activeTab === 'clean'   && <CleanTab />}
        </div>
      </div>
      <CommandPalette />
    </div>
  )
}
