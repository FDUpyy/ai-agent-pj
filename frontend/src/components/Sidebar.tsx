import React, { useEffect, useState } from "react"
import { MessageSquare, Plus, Settings, Trash2 } from "lucide-react"

interface Session {
  id: string
  title: string
  created_at: string
}

interface SidebarProps {
  currentSessionId: string | null
  onSessionSelect: (sessionId: string) => void
  onNewSession: () => void
  onDeleteSession: (sessionId: string) => void
  onOpenSettings: () => void
}

export function Sidebar({ currentSessionId, onSessionSelect, onNewSession, onDeleteSession, onOpenSettings }: SidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    fetchSessions()
  }, [currentSessionId]) // Refresh when session changes

  const fetchSessions = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/sessions")
      if (response.ok) {
        const data = await response.json()
        setSessions(data)
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error)
    }
  }
  
  const handleDelete = (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      if (confirm("确定要删除这个对话吗？")) {
          onDeleteSession(id)
          // Optimistic update
          setSessions(prev => prev.filter(s => s.id !== id))
      }
  }

  return (
    <div className="w-[260px] h-full bg-slate-50 border-r border-slate-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <button
          onClick={onNewSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          新对话
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSessionSelect(session.id)}
            className={`group w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors cursor-pointer ${
              currentSessionId === session.id
                ? "bg-white text-blue-600 shadow-sm border border-slate-100"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <span className="truncate text-sm font-medium flex-1">{session.title || "New Chat"}</span>
            
            <button 
                onClick={(e) => handleDelete(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded transition-all"
                title="删除会话"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200">
        <button 
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-sm"
        >
          <Settings className="w-4 h-4" />
          设置
        </button>
      </div>
    </div>
  )
}
