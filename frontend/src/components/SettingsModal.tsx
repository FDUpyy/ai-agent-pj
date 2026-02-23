import React, { useState, useEffect } from "react"
import { X, Save, RefreshCw } from "lucide-react"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Config {
  agent_prompt: string
  rag_settings: {
    top_k: number
    chunk_size: number
    similarity_threshold: number
  }
  model_settings: {
    temperature: number
    model: string
  }
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchConfig()
    }
  }, [isOpen])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch("http://127.0.0.1:8000/api/config")
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      }
    } catch (error) {
      console.error("Failed to load config:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const response = await fetch("http://127.0.0.1:8000/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (response.ok) {
        alert("智能体配置已更新")
        onClose()
      } else {
        alert("保存失败")
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      alert("保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-[600px] bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Agent Builder 配置中心</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : config ? (
            <>
              {/* System Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">系统提示词 (System Prompt)</label>
                <textarea
                  value={config.agent_prompt}
                  onChange={(e) => setConfig({ ...config, agent_prompt: e.target.value })}
                  className="w-full h-40 p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-mono"
                  placeholder="定义智能体的角色和行为..."
                />
                <p className="text-xs text-slate-400">支持使用 {"{{context}}"} 占位符插入 RAG 检索内容。</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* RAG Settings */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">RAG 检索参数</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-xs text-slate-600">Top K (检索数量)</label>
                        <span className="text-xs font-medium text-blue-600">{config.rag_settings.top_k}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={config.rag_settings.top_k}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rag_settings: { ...config.rag_settings, top_k: parseInt(e.target.value) },
                        })
                      }
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-600">Chunk Size (分片大小)</label>
                    <input
                      type="number"
                      value={config.rag_settings.chunk_size}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          rag_settings: { ...config.rag_settings, chunk_size: parseInt(e.target.value) },
                        })
                      }
                      className="w-full px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Model Settings */}
                <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-700">模型参数</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                        <label className="text-xs text-slate-600">Temperature (随机性)</label>
                        <span className="text-xs font-medium text-blue-600">{config.model_settings.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={config.model_settings.temperature}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          model_settings: { ...config.model_settings, temperature: parseFloat(e.target.value) },
                        })
                      }
                      className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-600">Model Name</label>
                    <input
                      type="text"
                      value={config.model_settings.model}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          model_settings: { ...config.model_settings, model: e.target.value },
                        })
                      }
                      className="w-full px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-slate-500">无法加载配置</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !config}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            保存并应用
          </button>
        </div>
      </div>
    </div>
  )
}
