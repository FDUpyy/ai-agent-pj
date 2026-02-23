import React, { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Eye, FileCode, PenTool } from "lucide-react"
import { CodeEditor } from "./CodeEditor"
import { RichTextEditor } from "./RichTextEditor"

interface WorkspaceProps {
  initialContent: string
  activeTab: "preview" | "edit"
  setActiveTab: (tab: "preview" | "edit") => void
  currentContent: string
  setCurrentContent: (content: string) => void
}

export function Workspace({
  initialContent,
  activeTab,
  setActiveTab,
  currentContent,
  setCurrentContent,
}: WorkspaceProps) {
  // Sync initial content to current content when it changes (e.g. new AI message)
  // BUT only if we haven't manually edited it yet or if we decide AI updates should override
  // For now, let's say AI updates only if we are not in edit mode or if content is empty
  useEffect(() => {
    // Only update from initialContent if we are in preview mode or content is empty
    // This allows streaming to work while in preview
    if (activeTab === "preview") {
        if (initialContent !== currentContent) {
            setCurrentContent(initialContent)
        }
    }
  }, [initialContent, activeTab])

  // We introduce a new "rich" mode
  const [viewMode, setViewMode] = useState<"preview" | "code" | "rich">("preview")

  // Sync activeTab prop with internal viewMode
  useEffect(() => {
      if (activeTab === "edit" && viewMode === "preview") {
          setViewMode("rich") // Default to rich text on edit
      } else if (activeTab === "preview" && viewMode !== "preview") {
          setViewMode("preview")
      }
  }, [activeTab])

  const handleModeChange = (mode: "preview" | "code" | "rich") => {
      setViewMode(mode)
      if (mode === "preview") {
          setActiveTab("preview")
      } else {
          setActiveTab("edit")
      }
  }

  return (
    <div className="flex flex-col h-full bg-white/0">
      {/* Toolbar */}
      <div className="border-b border-slate-100 px-6 py-3 flex items-center justify-between bg-white/0">
        <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-full border border-slate-200/50">
          <button
            onClick={() => handleModeChange("preview")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              viewMode === "preview"
                ? "bg-white text-blue-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }`}
          >
            <Eye className="w-4 h-4" />
            预览
          </button>
          <button
            onClick={() => handleModeChange("rich")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              viewMode === "rich"
                ? "bg-white text-blue-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }`}
          >
            <PenTool className="w-4 h-4" />
            富文本
          </button>
          <button
            onClick={() => handleModeChange("code")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              viewMode === "code"
                ? "bg-white text-blue-600 shadow-sm border border-slate-100"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }`}
          >
            <FileCode className="w-4 h-4" />
            源码
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === "preview" && (
          <div className="h-full overflow-y-auto p-8 text-slate-600">
            {currentContent ? (
              <div className="prose prose-slate max-w-none prose-headings:font-medium prose-a:text-blue-600">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentContent}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <Eye className="w-8 h-8 opacity-50" />
                </div>
                <p>暂无内容预览</p>
              </div>
            )}
          </div>
        )}
        
        {viewMode === "rich" && (
            <div className="h-full p-4 bg-slate-50">
                <RichTextEditor 
                    content={currentContent} 
                    onChange={(html) => setCurrentContent(html)} 
                />
                <div className="text-xs text-slate-400 mt-2 text-center">
                    注意：富文本模式下编辑的内容可能包含 HTML 标签，切换回源码模式可见。
                </div>
            </div>
        )}

        {viewMode === "code" && (
          <div className="h-full">
            <CodeEditor
              code={currentContent}
              onChange={(val) => setCurrentContent(val || "")}
              language="markdown"
            />
          </div>
        )}
      </div>
    </div>
  )
}
