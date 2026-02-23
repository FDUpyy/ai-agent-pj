import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "../lib/utils"
import { Pencil } from "lucide-react"

type Role = "user" | "ai" | "system"

interface MessageBubbleProps {
  role: Role
  content: string
  onEditCode?: (code: string) => void
}

export function MessageBubble({ role, content, onEditCode }: MessageBubbleProps) {
  const isUser = role === "user"

  const markdownComponents = {
    code({
      inline,
      className,
      children,
      ...props
    }: any) {
      const codeContent = String(children).replace(/\n$/, "")
      
      if (inline) {
        return (
          <code
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.8rem] text-slate-800 border border-slate-200"
            {...props}
          >
            {children}
          </code>
        )
      }
      return (
        <div className="relative group">
          {onEditCode && (
            <button
              onClick={() => onEditCode(codeContent)}
              className="absolute right-2 top-2 p-1.5 rounded-md bg-white/80 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-blue-500 hover:shadow-sm transition-all z-10 border border-transparent hover:border-slate-100"
              title="在右侧编辑"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <pre className="rounded-xl bg-slate-50 p-4 text-xs overflow-x-auto mt-2 mb-2 border border-slate-100 text-slate-700 shadow-sm">
            <code {...props}>{children}</code>
          </pre>
        </div>
      )
    },
  }

  if (role === "system") {
    return (
      <div className="w-full flex justify-center my-4">
        <div className="text-[11px] text-slate-500 bg-white/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 shadow-sm">
          {content}
        </div>
      </div>
    )
  }
  return (
    <div
      className={cn(
        "w-full flex mb-2",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-5 py-3 text-sm whitespace-pre-wrap break-words shadow-sm",
          isUser
            ? "bg-black text-white rounded-br-sm"
            : "bg-white text-slate-700 rounded-bl-sm border border-slate-50",
        )}
      >
        {isUser ? (
          content
        ) : (
          <div className="prose prose-sm max-w-none prose-slate">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
