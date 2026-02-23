import React, { useState, useEffect, useRef } from "react"
import { Database, Network, Play, Settings, ZoomIn, ZoomOut, Loader2 } from "lucide-react"
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d"

interface KnowledgeBase {
  id: string
  name: string
}

export function KnowledgeGraphView() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [selectedKbIds, setSelectedKbIds] = useState<Set<string>>(new Set())
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [generating, setGenerating] = useState(false)
  const [maxNodes, setMaxNodes] = useState(50)
  const [granularity, setGranularity] = useState<"fine" | "coarse">("fine")
  const [processAll, setProcessAll] = useState(false)
  const [depth, setDepth] = useState(1)
  const graphRef = useRef<ForceGraphMethods>()

  // Fetch KBs
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/knowledge_bases")
      .then((res) => res.json())
      .then(setKbs)
      .catch(console.error)
  }, [])

  const toggleKb = (id: string) => {
    const next = new Set(selectedKbIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedKbIds(next)
  }

  const handleGenerate = async () => {
    if (selectedKbIds.size === 0) return
    setGenerating(true)
    setGraphData({ nodes: [], links: [] }) // Clear previous graph
    try {
      const res = await fetch("http://127.0.0.1:8000/api/knowledge_graph/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            kb_ids: Array.from(selectedKbIds),
            max_nodes: maxNodes,
            granularity: granularity,
            process_all: processAll,
            depth: depth
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setGraphData(data)
        setTimeout(() => graphRef.current?.zoomToFit(400), 500)
      } else {
          alert("生成图谱失败，请重试")
      }
    } catch (e) {
      console.error("Failed to generate graph", e)
      alert("生成图谱时发生错误")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* Left Column: Source Selection */}
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-purple-600" />
            数据源选择
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {kbs.map((kb) => (
            <label
              key={kb.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${
                selectedKbIds.has(kb.id) ? "bg-purple-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selectedKbIds.has(kb.id)}
                onChange={() => toggleKb(kb.id)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-slate-700 truncate">{kb.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Middle Column: Graph Settings */}
      <div className="w-80 border-r border-slate-200 bg-slate-50/50 flex flex-col">
        <div className="p-6 border-b border-slate-200 bg-white">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            图谱设置
          </h3>
        </div>
        
        <div className="flex-1 p-6 space-y-6">
            <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">实体抽取粒度</label>
                <div className="flex gap-2 p-1 bg-slate-200 rounded-lg">
                    <button 
                        onClick={() => setGranularity("fine")}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md shadow-sm transition-all ${granularity === 'fine' ? 'bg-white text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        精细
                    </button>
                    <button 
                        onClick={() => setGranularity("coarse")}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md shadow-sm transition-all ${granularity === 'coarse' ? 'bg-white text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        粗略
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={processAll}
                        onChange={(e) => setProcessAll(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    处理全部切片 (全量构建)
                </label>
            </div>

            <div className={`space-y-3 transition-opacity ${processAll ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-700">抽取样本量</label>
                    <span className="text-xs font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{maxNodes}</span>
                </div>
                <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    step="10"
                    value={maxNodes} 
                    onChange={(e) => setMaxNodes(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600" 
                />
            </div>

            <div className="space-y-3">
                <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-700">抽取深度</label>
                    <span className="text-xs font-mono text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{depth}</span>
                </div>
                <input 
                    type="range" 
                    min="1" 
                    max="3" 
                    step="1"
                    value={depth} 
                    onChange={(e) => setDepth(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600" 
                />
                <div className="flex justify-between text-xs text-slate-400">
                    <span>骨架</span>
                    <span>常规</span>
                    <span>深挖</span>
                </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-700 leading-relaxed">
                <p>提示：全量构建或深度挖掘可能耗时较长 (1-5分钟)，请耐心等待。</p>
            </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-white">
            <button
                onClick={handleGenerate}
                disabled={generating || selectedKbIds.size === 0}
                className="w-full py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-lg shadow-purple-900/20 transition-all"
            >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
                {generating ? "正在抽取..." : "生成图谱"}
            </button>
        </div>
      </div>

      {/* Right Column: Graph Preview */}
      <div className="flex-1 bg-slate-900 relative overflow-hidden flex flex-col">
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <button 
                onClick={() => graphRef.current?.zoomToFit(400)}
                className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 shadow-lg border border-slate-700"
                title="适配视图"
            >
                <ZoomOut className="w-4 h-4" />
            </button>
        </div>
        
        {generating ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Network className="w-6 h-6 text-purple-500 animate-pulse" />
                    </div>
                </div>
                <div className="text-center">
                    <p className="text-slate-200 font-medium text-lg">正在构建知识网络</p>
                    <p className="text-sm text-slate-500 mt-1">AI 正在阅读文档并提取实体关系...</p>
                    <p className="text-xs text-slate-600 mt-4">深度挖掘模式 • 预计耗时较长</p>
                </div>
             </div>
        ) : graphData.nodes.length > 0 ? (
             <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeLabel="id"
                nodeAutoColorBy="group"
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={d => 0.005}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                backgroundColor="#0f172a"
                linkColor={() => "#334155"}
                nodeRelSize={6}
                nodeVal={(node) => (node as any).val || 1}
                onNodeDragEnd={node => {
                  node.fx = node.x;
                  node.fy = node.y;
                }}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const label = node.id || '';
                  const fontSize = 12 / globalScale;
                  ctx.font = `${fontSize}px Sans-Serif`;
                  const textWidth = ctx.measureText(label).width;
                  const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); 

                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                  ctx.fillStyle = node.color || '#a855f7';
                  ctx.fill();

                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                  ctx.fillText(label, node.x, node.y + 8);
                }}
                nodeCanvasObjectMode={() => 'replace'}
             />
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
                <Network className="w-16 h-16 mb-4 opacity-20" />
                <p>暂无图谱数据</p>
                <p className="text-xs mt-2">请在左侧选择数据源并生成</p>
            </div>
        )}
      </div>
    </div>
  )
}
