import React from "react"
import { MessageSquare, Network, Database, Settings, Puzzle } from "lucide-react"

type View = "chat" | "knowledge_base" | "knowledge_graph" | "agents" | "settings"

interface GlobalSidebarProps {
  currentView: View
  onChangeView: (view: View) => void
  onOpenSettings: () => void
}

export function GlobalSidebar({ currentView, onChangeView, onOpenSettings }: GlobalSidebarProps) {
  const navItems = [
    { id: "chat", icon: MessageSquare, label: "对话" },
    { id: "agents", icon: Puzzle, label: "智能体" },
    { id: "knowledge_base", icon: Database, label: "知识库" },
    { id: "knowledge_graph", icon: Network, label: "图谱" },
  ]

  return (
    <div className="w-[60px] h-full bg-slate-900 flex flex-col items-center py-6 gap-6 z-50">
      {/* Logo Placeholder */}
      <div className="w-8 h-8 rounded-lg bg-blue-500 mb-4 flex items-center justify-center text-white font-bold text-xs">
        AI
      </div>

      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onChangeView(item.id as View)}
          className={`p-3 rounded-xl transition-all group relative flex items-center justify-center ${
            currentView === item.id
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/50"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
          title={item.label}
        >
          <item.icon className="w-5 h-5" />
          {/* Tooltip */}
          <div className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
            {item.label}
          </div>
        </button>
      ))}

      <div className="flex-1" />

      <button
        onClick={onOpenSettings}
        className="p-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all"
        title="设置"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  )
}
