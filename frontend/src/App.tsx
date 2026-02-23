import React, { useState } from "react"
import { GlobalSidebar } from "./components/GlobalSidebar"
import { ChatView } from "./components/ChatView"
import { KnowledgeBaseView } from "./components/KnowledgeBaseView"
import { KnowledgeGraphView } from "./components/KnowledgeGraphView"
import { SettingsModal } from "./components/SettingsModal"

import { WorkflowBuilder } from "./components/WorkflowBuilder"

type View = "chat" | "knowledge_base" | "knowledge_graph" | "agents" | "settings"

function App() {
  const [currentAppView, setCurrentAppView] = useState<View>("chat")
  const [showSettings, setShowSettings] = useState(false)

  const renderContent = () => {
    switch (currentAppView) {
      case "chat":
        return <ChatView onOpenSettings={() => setShowSettings(true)} />
      case "knowledge_base":
        return <KnowledgeBaseView />
      case "knowledge_graph":
        return <KnowledgeGraphView />
      case "agents":
        return <WorkflowBuilder />
      default:
        return <ChatView onOpenSettings={() => setShowSettings(true)} />
    }
  }

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-800 flex overflow-hidden">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      
      {/* Far-Left Sidebar */}
      <GlobalSidebar 
        currentView={currentAppView} 
        onChangeView={setCurrentAppView}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}

export default App
