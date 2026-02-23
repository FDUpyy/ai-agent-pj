import React, { useState, useEffect } from "react"
import { Plus, Database, Upload, FileText, Settings2, Play, CheckCircle, Search, Trash2 } from "lucide-react"

interface KnowledgeBase {
  id: string
  name: string
  description: string
  created_at: string
}

export function KnowledgeBaseView() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [chunks, setChunks] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)

  // Config State
  const [splitMethod, setSplitMethod] = useState("token")
  const [chunkSize, setChunkSize] = useState(500)
  const [chunkOverlap, setChunkOverlap] = useState(50)
  
  // Creation State
  const [isCreating, setIsCreating] = useState(false)
  const [newKbName, setNewKbName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchKbs()
  }, [])

  const fetchKbs = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/knowledge_bases")
      if (res.ok) {
        const data = await res.json()
        setKbs(data)
      }
    } catch (e) {
      console.error("Failed to fetch KBs", e)
    }
  }
  
  const fetchKbChunks = async (kbId: string) => {
      try {
          const res = await fetch(`http://127.0.0.1:8000/api/knowledge_bases/${kbId}/chunks`)
          if (res.ok) {
              const data = await res.json()
              setChunks(data)
          }
      } catch (e) {
          console.error("Failed to fetch chunks", e)
          setChunks([])
      }
  }

  const handleStartCreate = () => {
      setIsCreating(true)
      setSelectedKb(null)
      setNewKbName("")
      setFile(null)
      setChunks([])
  }

  const handleSelectKb = (kb: KnowledgeBase) => {
      setIsCreating(false)
      setSelectedKb(kb)
      setNewKbName(kb.name)
      setFile(null)
      fetchKbChunks(kb.id)
  }
  
  const handleDeleteKb = async (e: React.MouseEvent, kbId: string) => {
      e.stopPropagation() // Prevent selection
      if (!confirm("确定要删除该知识库吗？这将同时删除所有已索引的文档切片。")) return
      
      try {
          const res = await fetch(`http://127.0.0.1:8000/api/knowledge_bases/${kbId}`, {
              method: "DELETE"
          })
          if (res.ok) {
              setKbs(prev => prev.filter(k => k.id !== kbId))
              if (selectedKb?.id === kbId) {
                  setSelectedKb(null)
                  setChunks([])
              }
          }
      } catch (e) {
          console.error("Failed to delete KB", e)
      }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setFile(f)
      // Auto-detect excel
      if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv")) {
          setSplitMethod("markdown") // Placeholder for structured split
      }
    }
  }

  const handleProcess = async () => {
    if (!file) return
    setProcessing(true)
    setChunks([])

    try {
        let currentKbId = selectedKb?.id
        let targetKb = selectedKb

        // 1. If creating new KB, create it first
        if (isCreating) {
             if (!newKbName.trim()) {
                 alert("请输入知识库名称")
                 setProcessing(false)
                 return
             }
             const createRes = await fetch("http://127.0.0.1:8000/api/knowledge_bases", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newKbName, description: "Created via UI" }),
             })
             if (!createRes.ok) throw new Error("Failed to create KB")
             targetKb = await createRes.json()
             if (targetKb) {
                 currentKbId = targetKb.id
                 setKbs([targetKb, ...kbs])
                 setSelectedKb(targetKb)
                 setIsCreating(false)
             }
        }

        if (!currentKbId) {
             throw new Error("No KB selected")
        }

        // 2. Ingest file and get chunks
        const formData = new FormData()
        formData.append("file", file)
        formData.append("chunk_size", chunkSize.toString())
        formData.append("chunk_overlap", chunkOverlap.toString())
        formData.append("split_method", splitMethod)
        // Note: Backend now returns chunks even if preview_only=False (if docs are returned)
        // Or we use preview_only=False to save, and hope backend returns docs.
        // My updated backend code returns: "preview_chunks": [doc.page_content for doc in docs] if docs else []
        // So we can just use default (preview_only=False) and get chunks.
        
        const res = await fetch(`http://127.0.0.1:8000/api/knowledge_bases/${currentKbId}/ingest`, {
            method: "POST",
            body: formData,
        })
      
        if (res.ok) {
            const data = await res.json()
            if (data.preview_chunks) {
                // If appending, we might want to append to current chunks view or refresh all?
                // For now, let's just show the NEW chunks to confirm ingestion.
                // Or maybe re-fetch all chunks?
                // Re-fetching all is safer to show complete state.
                await fetchKbChunks(currentKbId)
            }
            alert("处理完成并保存！")
            setFile(null) // Clear file input
        } else {
            alert("Processing failed")
        }
    } catch (e) {
      console.error("Processing error", e)
      alert("Error processing file")
    } finally {
      setProcessing(false)
    }
  }
  
  const filteredKbs = kbs.filter(kb => kb.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* Left Column: KB List */}
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            我的知识库
          </h2>
          <div className="flex gap-2">
            <div className="flex-1 relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="搜索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            <button
              onClick={handleStartCreate}
              className={`p-2 rounded-lg transition-colors ${isCreating ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="新建知识库"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredKbs.map((kb) => (
            <div
              key={kb.id}
              onClick={() => handleSelectKb(kb)}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between group cursor-pointer transition-colors ${
                selectedKb?.id === kb.id
                  ? "bg-blue-50 text-blue-700 border border-blue-100"
                  : "text-slate-600 hover:bg-slate-50 border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                  <Database className="w-4 h-4 flex-shrink-0 opacity-70" />
                  <div className="overflow-hidden">
                    <div className="text-sm font-medium truncate">{kb.name}</div>
                    <div className="text-[10px] text-slate-400">
                        {kb.created_at ? new Date(kb.created_at).toLocaleDateString() : '刚刚'}
                    </div>
                  </div>
              </div>
              
              <button
                  onClick={(e) => handleDeleteKb(e, kb.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                  title="删除知识库"
              >
                  <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Middle Column: Builder & Config */}
      <div className="w-96 border-r border-slate-200 bg-slate-50/50 flex flex-col">
        <div className="p-6 border-b border-slate-200 bg-white">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-1">
            <Settings2 className="w-4 h-4" />
            配置与处理
          </h3>
          <p className="text-xs text-slate-400 truncate">
              {isCreating 
                ? "新建知识库并导入数据" 
                : `管理: ${selectedKb?.name}`
              }
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* KB Name Input - Hidden if appending */}
            {isCreating && (
                <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700">知识库名称</label>
                    <input 
                        value={newKbName}
                        onChange={(e) => setNewKbName(e.target.value)}
                        placeholder="输入知识库名称..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                </div>
            )}
            
            {!isCreating && selectedKb && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                    正在向 <strong>{selectedKb.name}</strong> 追加文档
                </div>
            )}

            {/* Upload */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">上传文件</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-white hover:border-blue-400 transition-colors group cursor-pointer relative">
                    <input 
                        type="file" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={handleFileChange}
                        accept=".txt,.md,.pdf,.docx,.xlsx,.csv"
                    />
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-sm text-slate-600 font-medium">
                        {file ? file.name : "点击或拖拽上传"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">支持 PDF, Word, Excel, Txt</p>
                </div>
            </div>

            {/* Strategy */}
            <div className="space-y-4">
                <label className="text-sm font-medium text-slate-700">切片策略</label>
                
                <div className="space-y-2">
                    <span className="text-xs text-slate-500">切分方式</span>
                    <select 
                        value={splitMethod}
                        onChange={(e) => setSplitMethod(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    >
                        <option value="token">按 Token (通用)</option>
                        <option value="regex">按正则 (自定义)</option>
                        <option value="markdown">按 Markdown 结构</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-xs text-slate-500">Chunk Size</span>
                        <span className="text-xs font-medium text-blue-600">{chunkSize}</span>
                    </div>
                    <input 
                        type="range" min="100" max="2000" step="100"
                        value={chunkSize}
                        onChange={(e) => setChunkSize(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-xs text-slate-500">Overlap</span>
                        <span className="text-xs font-medium text-blue-600">{chunkOverlap}</span>
                    </div>
                    <input 
                        type="range" min="0" max="500" step="10"
                        value={chunkOverlap}
                        onChange={(e) => setChunkOverlap(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>
            </div>
        </div>

        {/* Action Footer */}
        <div className="p-6 border-t border-slate-200 bg-white">
            <button
                onClick={handleProcess}
                disabled={(!selectedKb && !isCreating) || !file || processing}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium transition-all shadow-lg shadow-slate-900/20"
            >
                {processing ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <Play className="w-4 h-4" />
                )}
                {processing ? "处理中..." : (isCreating ? "创建并导入" : "追加文档")}
            </button>
        </div>
      </div>

      {/* Right Column: Preview */}
      <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden">
        <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-500" />
                <h3 className="font-semibold text-slate-700">
                    {selectedKb ? `切片预览: ${selectedKb.name}` : "切片预览"}
                </h3>
                {chunks.length > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        共 {chunks.length} 个切片
                    </span>
                )}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chunks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <FileText className="w-12 h-12 mb-3 opacity-20" />
                    <p>暂无切片数据</p>
                    <p className="text-xs mt-1">
                        {isCreating ? "请在左侧配置并开始处理" : "选择左侧知识库以加载切片"}
                    </p>
                </div>
            ) : (
                chunks.map((chunk, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative">
                        <div className="absolute top-4 right-4 text-xs font-mono text-slate-300">#{idx + 1}</div>
                        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-mono">
                            {chunk}
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  )
}
