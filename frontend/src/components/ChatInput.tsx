import React, { FormEvent, useRef, useState, useEffect } from "react"
import { Loader2, Paperclip, SendHorizontal } from "lucide-react"
import { MentionsInput, Mention, SuggestionDataItem } from "react-mentions"

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  sending: boolean
  error: string | null
  onSend: () => Promise<void>
  onFileUploaded: (message: string) => void
}

interface FileAttachment {
    id: string
    name: string
}

export function ChatInput({
  input,
  setInput,
  sending,
  error,
  onSend,
  onFileUploaded,
}: ChatInputProps) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [kbSuggestions, setKbSuggestions] = useState<SuggestionDataItem[]>([])
  const [sessionAttachments, setSessionAttachments] = useState<FileAttachment[]>([])

  // Fetch KBs for suggestions
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/knowledge_bases")
        .then(res => res.json())
        .then(data => {
            const suggestions = data.map((kb: any) => ({
                id: kb.id,
                display: kb.name
            }))
            setKbSuggestions(suggestions)
        })
        .catch(console.error)
  }, [])
  
  // Combine permanent KBs and temporary session attachments
  const combinedSuggestions = [
      ...kbSuggestions,
      ...sessionAttachments.map(f => ({ id: f.id, display: f.name }))
  ]

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!input.trim() || sending || isUploading) return
    void onSend()
  }

  // Handle MentionsInput change
  const handleChange = (event: { target: { value: string } }, newValue: string, newPlainTextValue: string, mentions: any[]) => {
      setInput(newValue)
  }

  // Handle enter key manually since MentionsInput overrides standard inputs
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        if (!input.trim() || sending || isUploading) return
        void onSend()
    }
  }

  const handleIconClick = () => {
    if (sending || isUploading) return
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("http://127.0.0.1:8000/api/ingest", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`)
      }
      const data = await response.json()
      const name = data.filename || file.name
      
      const newFileId = `file-${Date.now()}`
      setSessionAttachments(prev => [...prev, { id: newFileId, name: name }])

      onFileUploaded(`📄 ${name} 已加入知识库`)
    } catch {
      onFileUploaded("文件上传失败，请稍后重试。")
    } finally {
      setIsUploading(false)
    }
  }

  // Custom styling for mentions
  const mentionStyle: any = {
    control: {
      backgroundColor: 'transparent',
      fontSize: 14,
      fontWeight: 'normal',
      lineHeight: 1.5,
      fontFamily: 'inherit',
    },
    '&multiLine': {
      control: {
        fontFamily: 'inherit',
        minHeight: 40,
      },
      highlighter: {
        padding: 9,
        border: '1px solid transparent',
        fontFamily: 'inherit', 
      },
      input: {
        padding: 9,
        border: '1px solid transparent',
        outline: 0,
        fontFamily: 'inherit', 
        color: 'transparent',
        caretColor: '#334155', 
      },
    },
    '&singleLine': {
      display: 'inline-block',
      width: '100%',
      highlighter: {
        padding: 1,
        border: '2px inset transparent',
        fontFamily: 'inherit', 
      },
      input: {
        padding: 1,
        border: '2px inset transparent',
        fontFamily: 'inherit', 
        color: 'transparent', 
        caretColor: '#334155',
      },
    },
    suggestions: {
      list: {
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        fontSize: 14,
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        maxHeight: 400, 
        width: 300, 
        overflowY: 'auto',
        position: 'absolute', 
        bottom: '100%',
        left: 0,
        zIndex: 100,
        padding: 4,
      },
      item: {
        padding: '8px 12px',
        borderBottom: '1px solid #f1f5f9',
        borderRadius: 4,
        '&focused': {
          backgroundColor: '#eff6ff',
          color: '#2563eb',
        },
      },
    },
  }

  return (
    <form
      className="flex items-center gap-2 p-2 relative"
      onSubmit={handleSubmit}
    >
        {error && (
          <div className="absolute -top-8 left-4 text-xs text-red-400 truncate max-w-xs bg-red-50 px-2 py-1 rounded-md border border-red-100">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleIconClick}
          disabled={sending || isUploading}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="上传文件"
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </button>

        <div className="flex-1 relative">
            <MentionsInput
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                style={mentionStyle}
                placeholder={sending ? "正在生成回答..." : "输入消息... (输入 @ 引用知识库)"}
                className="mentions-input w-full bg-transparent text-slate-700 text-sm outline-none placeholder:text-slate-400"
                disabled={sending || isUploading}
                singleLine={true}
                allowSpaceInQuery={true} // Allow searching with spaces
            >
                <Mention
                    trigger="@" 
                    data={combinedSuggestions}
                    markup="@[__display__](__id__)"
                    className="bg-blue-100 text-blue-600 rounded px-1 font-medium mx-0.5 z-10 relative"
                    displayTransform={(id, display) => `@${display}`}
                />
            </MentionsInput>
            
            <style>{`
                .mentions-input textarea {
                    color: transparent !important;
                    caret-color: #334155 !important;
                    font-family: inherit !important;
                    letter-spacing: normal !important;
                }
                .mentions-input div[class$="__highlighter"] {
                    color: #334155 !important;
                    font-family: inherit !important;
                    letter-spacing: normal !important;
                    border: 1px solid transparent; 
                }
            `}</style>
        </div>

        <button
          type="submit"
          disabled={sending || isUploading || !input.trim()}
          className="p-2 bg-slate-900 text-white rounded-full hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex-shrink-0"
        >
          <SendHorizontal className="w-4 h-4" />
        </button>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </form>
  )
}
