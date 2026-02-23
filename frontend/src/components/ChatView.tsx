import React, { useMemo, useState, useEffect } from "react"
import { MessageBubble } from "./MessageBubble"
import { ChatInput } from "./ChatInput"
import { Workspace } from "./Workspace"
import { useChatStream } from "../hooks/useChatStream"
import { DownloadManager } from "./DownloadManager"
import { Sidebar } from "./Sidebar"
import { SettingsModal } from "./SettingsModal"

interface ChatViewProps {
  onOpenSettings: () => void
}

export function ChatView({ onOpenSettings }: ChatViewProps) {
  const {
    messages,
    setMessages,
    input,
    setInput,
    sending,
    error,
    send,
    addSystemMessage,
    containerRef,
    currentArtifact,
    isParsingArtifact,
    sessionId,
    setSessionId
  } = useChatStream()

  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview")
  const [currentContent, setCurrentContent] = useState("")
  const isInitialized = React.useRef(false)

  // Auto-create new session on load if none exists
  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    fetch("http://127.0.0.1:8000/api/sessions")
        .then(res => res.json())
        .then(sessions => {
            if (sessions && sessions.length > 0) {
                // Load the most recent session
                setSessionId(sessions[0].id)
            } else {
                handleNewSession()
            }
        })
        .catch(() => {
             handleNewSession()
        })
  }, [])

  const handleNewSession = async () => {
      try {
          const response = await fetch("http://127.0.0.1:8000/api/sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: "New Chat" })
          })
          if (response.ok) {
              const data = await response.json()
              setSessionId(data.id)
              setMessages([])
              setCurrentContent("")
          }
      } catch (error) {
          console.error("Failed to create new session:", error)
      }
  }
  
  const handleDeleteSession = async (idToDelete: string) => {
      try {
          const response = await fetch(`http://127.0.0.1:8000/api/sessions/${idToDelete}`, {
              method: "DELETE"
          })
          
          if (response.ok) {
              // If we deleted the current session, create a new one
              if (sessionId === idToDelete) {
                  await handleNewSession()
              }
          }
      } catch (error) {
          console.error("Failed to delete session:", error)
      }
  }

  // Update workspace content when artifact changes
  useEffect(() => {
    if (currentArtifact) {
        setCurrentContent(currentArtifact.content)
    }
  }, [currentArtifact])

  // Also sync normal AI messages if no artifact is being parsed (fallback)
  const lastAiMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "ai"),
    [messages],
  )
  
  // Only sync normal message if we are NOT in artifact mode
  useEffect(() => {
    if (!currentArtifact && !isParsingArtifact && lastAiMessage && activeTab === "preview") {
        setCurrentContent(lastAiMessage.content)
    }
  }, [lastAiMessage, currentArtifact, isParsingArtifact, activeTab])


  const handleEditCode = (code: string) => {
    setCurrentContent(code)
    setActiveTab("edit")
  }
  
  // Construct a temporary artifact object for DownloadManager when not in artifact mode
  // This allows downloading content even from normal chat
  const effectiveArtifact = currentArtifact || (currentContent ? {
      title: "Generated Content",
      type: "text/markdown",
      filename: "content.md",
      content: currentContent
  } : null)

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        currentSessionId={sessionId}
        onSessionSelect={setSessionId}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={onOpenSettings}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
          {/* Left Chat Area */}
          <div className="w-[40%] flex flex-col relative z-10 glass border-r border-white/20">
            <div
              ref={containerRef}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  onEditCode={handleEditCode}
                />
              ))}
              {sending && !isParsingArtifact && (
                 <div className="text-xs text-slate-400 animate-pulse px-4">AI 正在思考...</div>
              )}
               {isParsingArtifact && (
                 <div className="text-xs text-blue-500 animate-pulse px-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    正在生成文档: {currentArtifact?.title || "Artifact"}...
                 </div>
              )}
            </div>
            
            {/* Input Area */}
            <div className="p-6">
                <div className="shadow-lg rounded-full bg-white/90 backdrop-blur border border-white/50 overflow-hidden">
                    <ChatInput
                      input={input}
                      setInput={setInput}
                      sending={sending}
                      error={error}
                      onSend={send}
                      onFileUploaded={addSystemMessage}
                    />
                </div>
            </div>
          </div>

          {/* Right Workspace Area */}
          <div className="w-[60%] flex flex-col bg-slate-50/50 p-6">
            <div className="glass-card rounded-[30px] flex-1 flex flex-col overflow-hidden relative">
                {/* Header */}
                <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm">
                     <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-slate-700">
                            {currentArtifact ? currentArtifact.title : "工作区"}
                        </div>
                        {currentArtifact && (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 uppercase tracking-wide">
                                {currentArtifact.type.split('/').pop()?.split('.').pop() || 'TEXT'}
                            </span>
                        )}
                     </div>
                     
                     <div className="flex items-center gap-3">
                         <DownloadManager artifact={effectiveArtifact} />
                     </div>
                </div>
                
                {/* Body */}
                <div className="flex-1 overflow-hidden">
                    <Workspace
                      initialContent=""
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      currentContent={currentContent}
                      setCurrentContent={setCurrentContent}
                    />
                </div>
            </div>
          </div>
      </div>
    </div>
  )
}
