import React, { useState } from "react"
import { Download, ChevronDown, FileText, Code, FileType } from "lucide-react"
import { saveAs } from "file-saver"

interface DownloadManagerProps {
  artifact: {
    title: string
    type: string
    filename: string
    content: string
  } | null
}

export function DownloadManager({ artifact }: DownloadManagerProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!artifact) return null

  const handleDownload = async (format: "source" | "pdf" | "docx") => {
    setIsOpen(false)
    
    if (format === "source") {
        const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" })
        saveAs(blob, artifact.filename)
        return
    }

    // For PDF/Docx conversion, we would typically call backend
    // Since backend implementation for direct conversion is mocked in this prompt's scope 
    // (except for template generation), we will simulate or use simple blob for now.
    
    if (artifact.type === "template-data") {
        // This is where we'd call the backend generate_from_template
        // const response = await fetch('/api/generate-document', {
        //    method: 'POST',
        //    body: JSON.stringify({ template: artifact.filename, data: JSON.parse(artifact.content) })
        // })
        // const blob = await response.blob()
        // saveAs(blob, artifact.filename.replace('.json', '.docx'))
        alert("后端模版生成接口已就绪，前端暂模拟下载 JSON 数据。")
        const blob = new Blob([artifact.content], { type: "application/json" })
        saveAs(blob, `data_for_${artifact.filename}.json`)
    } else {
        // Fallback for code/text artifacts
        const blob = new Blob([artifact.content], { type: "text/plain;charset=utf-8" })
        saveAs(blob, artifact.filename)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-slate-600 hover:bg-slate-50 transition-all shadow-sm border border-slate-100 text-sm font-medium"
      >
        <Download className="w-4 h-4" />
        <span>下载</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-50 p-2 z-50 flex flex-col gap-1">
          <button
            onClick={() => handleDownload("source")}
            className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors text-left"
          >
            <Code className="w-4 h-4 text-blue-500" />
            源码/文本
          </button>
          
          {(artifact.type.includes("document") || artifact.type === "template-data") && (
            <>
              <button
                onClick={() => handleDownload("docx")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors text-left"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                Word 文档
              </button>
              <button
                onClick={() => handleDownload("pdf")}
                className="flex items-center gap-3 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors text-left"
              >
                <FileType className="w-4 h-4 text-red-500" />
                PDF 文档
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
