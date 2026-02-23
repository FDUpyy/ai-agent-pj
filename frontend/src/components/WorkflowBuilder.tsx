import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge,
  Connection,
  Panel,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Save, Play, Box, Code, MessageSquare, Split, FileText, Plus, Trash2, FileOutput, FileEdit, Image, Video, Circle } from 'lucide-react';
import { nodeTypes } from './nodes/CustomNodes';

interface WorkflowBuilderProps {
    onSave?: (flow: any) => void;
}

const initialNodes: Node[] = [
  {
    id: 'start-1',
    type: 'input',
    data: { label: '用户输入 (Start)' },
    position: { x: 250, y: 50 },
    className: 'bg-white border-2 border-slate-200 rounded-xl shadow-sm p-3 w-40 text-center font-medium text-slate-700',
  },
];

interface Agent {
    id: string;
    name: string;
    nodes: any;
    edges: any;
    created_at: string;
}

export function WorkflowBuilder({ onSave }: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  // Agent List State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("未命名智能体");

  // Knowledge Base State
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);

  useEffect(() => {
      fetchAgents();
      fetchKnowledgeBases();
  }, []);

  const fetchKnowledgeBases = async () => {
      try {
          const res = await fetch("http://127.0.0.1:8000/api/knowledge_bases");
          if (res.ok) {
              const data = await res.json();
              setKnowledgeBases(data);
          }
      } catch (e) {
          console.error("Failed to fetch KBs", e);
      }
  };

  const fetchAgents = async () => {
      try {
          const res = await fetch("http://127.0.0.1:8000/api/agents");
          if (res.ok) {
              const data = await res.json();
              setAgents(data);
          }
      } catch (e) {
          console.error("Failed to fetch agents", e);
      }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
        ...params, 
        animated: true, 
        style: { stroke: '#64748b', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }
    }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      let label = 'New Node';
      if (type === 'llm') label = 'LLM 大模型';
      if (type === 'script') label = 'Python 脚本';
      if (type === 'retriever') label = '知识库检索';
      if (type === 'condition') label = '条件判断';
      if (type === 'end') label = '结束节点';

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: type, // Use custom type
        position,
        data: { 
            label: label,
            inputs: [],
            outputs: [],
            config: {} // Store node specific config here
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
  }

  const onPaneClick = () => {
      setSelectedNode(null);
  }

  const updateNodeData = (key: string, value: any) => {
      if (!selectedNode) return;
      
      const newData = { ...selectedNode.data, config: { ...selectedNode.data.config, [key]: value } };
      
      setNodes((nds) => 
        nds.map((n) => n.id === selectedNode.id ? { ...n, data: newData } : n)
      );
      setSelectedNode({ ...selectedNode, data: newData });
  };

  const addVariable = (type: 'inputs' | 'outputs') => {
      if (!selectedNode) return;
      const newVar = { name: `var_${Date.now()}`, type: 'string' };
      const currentVars = selectedNode.data[type] || [];
      const newData = { ...selectedNode.data, [type]: [...currentVars, newVar] };
      
      setNodes((nds) => 
        nds.map((n) => n.id === selectedNode.id ? { ...n, data: newData } : n)
      );
      setSelectedNode({ ...selectedNode, data: newData });
  };

  const removeVariable = (type: 'inputs' | 'outputs', index: number) => {
      if (!selectedNode) return;
      const currentVars = [...(selectedNode.data[type] || [])];
      currentVars.splice(index, 1);
      const newData = { ...selectedNode.data, [type]: currentVars };
      
      setNodes((nds) => 
        nds.map((n) => n.id === selectedNode.id ? { ...n, data: newData } : n)
      );
      setSelectedNode({ ...selectedNode, data: newData });
  };

  const updateVariable = (type: 'inputs' | 'outputs', index: number, field: string, value: string) => {
      if (!selectedNode) return;
      const currentVars = [...(selectedNode.data[type] || [])];
      currentVars[index] = { ...currentVars[index], [field]: value };
      const newData = { ...selectedNode.data, [type]: currentVars };
      
      setNodes((nds) => 
        nds.map((n) => n.id === selectedNode.id ? { ...n, data: newData } : n)
      );
      setSelectedNode({ ...selectedNode, data: newData });
  };

  const handleSave = async () => {
      if (reactFlowInstance) {
          const flow = reactFlowInstance.toObject();
          const payload = {
              name: agentName,
              nodes: flow.nodes,
              edges: flow.edges
          };
          
          try {
              const url = currentAgentId 
                ? `http://127.0.0.1:8000/api/agents/${currentAgentId}`
                : "http://127.0.0.1:8000/api/agents";
              
              const method = currentAgentId ? "PUT" : "POST";
              
              const res = await fetch(url, {
                  method: method,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload)
              });
              
              if (res.ok) {
                  const savedAgent = await res.json();
                  alert("保存成功！");
                  setCurrentAgentId(savedAgent.id);
                  fetchAgents();
              } else {
                  alert("保存失败");
              }
          } catch (e) {
              console.error("Save error", e);
              alert("保存出错");
          }
      }
  }
  
  const loadAgent = (agent: Agent) => {
      setNodes(agent.nodes || []);
      setEdges(agent.edges || []);
      setCurrentAgentId(agent.id);
      setAgentName(agent.name);
  }
  
  const handleNewAgent = () => {
      setNodes(initialNodes);
      setEdges([]);
      setCurrentAgentId(null);
      setAgentName("未命名智能体");
  }

  // Node Palette Item
  const PaletteItem = ({ type, label, icon: Icon, color = "bg-slate-100" }: any) => {
      const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
      };

      return (
        <div 
            className={`flex flex-col items-center gap-2 p-3 min-w-[80px] bg-white border border-slate-200 rounded-xl cursor-grab hover:shadow-md transition-all active:scale-95 hover:border-blue-300`}
            onDragStart={(event) => onDragStart(event, type)}
            draggable
        >
            <div className={`p-2 ${color} rounded-lg text-slate-600`}>
                <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-600 text-center">{label}</span>
        </div>
      )
  }

  return (
    <div className="flex h-full w-full bg-slate-50">
      <ReactFlowProvider>
        {/* Left Sidebar: Agent List */}
        <div className="w-64 border-r border-slate-200 bg-white flex flex-col z-10">
            <div className="p-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Box className="w-5 h-5 text-blue-600" />
                    我的智能体
                </h2>
                <button 
                    onClick={handleNewAgent}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    新建智能体
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {agents.map(agent => (
                    <button
                        key={agent.id}
                        onClick={() => loadAgent(agent)}
                        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                            currentAgentId === agent.id 
                                ? "bg-blue-50 text-blue-700 border border-blue-100" 
                                : "text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                        <Box className="w-4 h-4 flex-shrink-0 opacity-70" />
                        <div className="truncate text-sm font-medium">{agent.name}</div>
                    </button>
                ))}
            </div>
        </div>

        {/* Center Canvas Area */}
        <div className="flex-1 h-full relative flex flex-col">
            {/* Top Bar */}
            <div className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between z-20">
                <input 
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="text-lg font-bold text-slate-800 bg-transparent border-none focus:ring-0 placeholder:text-slate-300"
                    placeholder="智能体名称"
                />
                <div className="flex gap-2">
                    <button 
                        onClick={handleSave}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg shadow hover:bg-slate-800 transition-all text-sm font-medium"
                    >
                        <Save className="w-4 h-4" />
                        保存并发布
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-all text-sm font-medium">
                        <Play className="w-4 h-4" />
                        调试
                    </button>
                </div>
            </div>

            {/* React Flow Canvas */}
            <div className="flex-1 relative bg-slate-50/50">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onInit={setReactFlowInstance}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
                    fitView
                    className="bg-slate-50"
                >
                    <Background color="#94a3b8" gap={20} size={1} />
                    <Controls className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden" />
                    <MiniMap className="border border-slate-200 shadow-sm rounded-lg" />
                </ReactFlow>
            </div>

            {/* Bottom Palette */}
            <div className="h-24 bg-white border-t border-slate-200 px-6 flex items-center gap-4 overflow-x-auto z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="text-xs font-bold text-slate-400 uppercase mr-2 shrink-0">组件库</div>
                <PaletteItem type="llm" label="LLM 大模型" icon={MessageSquare} color="bg-blue-50" />
                <PaletteItem type="retriever" label="知识库检索" icon={FileText} color="bg-orange-50" />
                <PaletteItem type="condition" label="条件判断" icon={Split} color="bg-purple-50" />
                <PaletteItem type="script" label="Python 脚本" icon={Code} color="bg-green-50" />
                <div className="w-px h-10 bg-slate-200 mx-2 shrink-0" />
                <PaletteItem type="end" label="结束节点" icon={Circle} color="bg-slate-100" />
            </div>
        </div>

        {/* Right Config Panel */}
        <div className="w-80 border-l border-slate-200 bg-white flex flex-col z-10 shadow-xl shadow-slate-200/50">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    节点配置
                </h3>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
                {selectedNode ? (
                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">节点名称</label>
                                <input 
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                                    value={selectedNode.data.label}
                                    onChange={(e) => {
                                        const newLabel = e.target.value;
                                        setNodes((nds) => 
                                            nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, label: newLabel } } : n)
                                        );
                                        // Force update local state for immediate feedback
                                        setSelectedNode(prev => prev ? ({ ...prev, data: { ...prev.data, label: newLabel } }) : null);
                                    }}
                                />
                            </div>
                            <div className="text-xs text-slate-400 font-mono">ID: {selectedNode.id}</div>
                        </div>
                        
                        {/* I/O Variables */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase flex justify-between items-center">
                                输入变量
                                <button onClick={() => addVariable('inputs')} className="hover:bg-slate-200 p-1 rounded">
                                    <Plus className="w-3 h-3 text-blue-600" />
                                </button>
                            </label>
                            <div className="space-y-2">
                                {(selectedNode.data.inputs || []).map((v: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input 
                                            className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded" 
                                            value={v.name} 
                                            onChange={(e) => updateVariable('inputs', idx, 'name', e.target.value)}
                                            placeholder="变量名"
                                        />
                                        <select 
                                            className="w-20 px-1 py-1 text-xs border border-slate-200 rounded bg-white"
                                            value={v.type}
                                            onChange={(e) => updateVariable('inputs', idx, 'type', e.target.value)}
                                        >
                                            <option value="string">String</option>
                                            <option value="number">Number</option>
                                            <option value="boolean">Boolean</option>
                                        </select>
                                        <button onClick={() => removeVariable('inputs', idx)} className="text-slate-400 hover:text-red-500">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {(!selectedNode.data.inputs || selectedNode.data.inputs.length === 0) && (
                                    <div className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded text-center">暂无输入变量</div>
                                )}
                            </div>
                        </div>

                        {/* Output Variables */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase flex justify-between items-center">
                                输出变量
                                <button onClick={() => addVariable('outputs')} className="hover:bg-slate-200 p-1 rounded">
                                    <Plus className="w-3 h-3 text-blue-600" />
                                </button>
                            </label>
                            <div className="space-y-2">
                                {(selectedNode.data.outputs || []).map((v: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input 
                                            className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded" 
                                            value={v.name} 
                                            onChange={(e) => updateVariable('outputs', idx, 'name', e.target.value)}
                                            placeholder="变量名"
                                        />
                                        <select 
                                            className="w-20 px-1 py-1 text-xs border border-slate-200 rounded bg-white"
                                            value={v.type}
                                            onChange={(e) => updateVariable('outputs', idx, 'type', e.target.value)}
                                        >
                                            <option value="string">String</option>
                                            <option value="number">Number</option>
                                            <option value="boolean">Boolean</option>
                                        </select>
                                        <button onClick={() => removeVariable('outputs', idx)} className="text-slate-400 hover:text-red-500">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                {(!selectedNode.data.outputs || selectedNode.data.outputs.length === 0) && (
                                    <div className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded text-center">暂无输出变量</div>
                                )}
                            </div>
                        </div>

                        {/* Node Specific Config */}
                        <div className="border-t border-slate-100 pt-4 space-y-4">
                            <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">核心参数</label>
                            
                            {selectedNode.type === 'llm' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">模型</label>
                                        <select 
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                            value={selectedNode.data.config?.model || 'GPT-4o'}
                                            onChange={(e) => updateNodeData('model', e.target.value)}
                                        >
                                            <option value="GPT-4o">GPT-4o</option>
                                            <option value="GPT-3.5-Turbo">GPT-3.5-Turbo</option>
                                            <option value="Claude-3-Opus">Claude-3-Opus</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">System Prompt</label>
                                        <textarea 
                                            className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
                                            placeholder="你是..."
                                            value={selectedNode.data.config?.system_prompt || ''}
                                            onChange={(e) => updateNodeData('system_prompt', e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                            
                            {selectedNode.type === 'script' && (
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500">Python Code</label>
                                    <textarea 
                                        className="w-full h-48 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono bg-slate-900 text-green-400 focus:outline-none resize-none"
                                        value={selectedNode.data.config?.code || `def main(args):\n    return {"result": "ok"}`}
                                        onChange={(e) => updateNodeData('code', e.target.value)}
                                    />
                                </div>
                            )}

                            {selectedNode.type === 'retriever' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">知识库</label>
                                        <select 
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                                            value={selectedNode.data.config?.kb_id || ''}
                                            onChange={(e) => updateNodeData('kb_id', e.target.value)}
                                        >
                                            <option value="">选择知识库...</option>
                                            {knowledgeBases.map(kb => (
                                                <option key={kb.id} value={kb.id}>{kb.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">Top K</label>
                                        <input 
                                            type="number"
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                            value={selectedNode.data.config?.top_k || 3}
                                            onChange={(e) => updateNodeData('top_k', parseInt(e.target.value))}
                                        />
                                    </div>
                                </>
                            )}
                            
                            {selectedNode.type === 'condition' && (
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500">表达式</label>
                                    <input 
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                                        placeholder="var == 'true'"
                                        value={selectedNode.data.config?.expression || ''}
                                        onChange={(e) => updateNodeData('expression', e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Box className="w-16 h-16 mb-4 opacity-10" />
                        <p className="text-sm font-medium">请选择一个节点</p>
                        <p className="text-xs mt-1">在右侧配置参数</p>
                    </div>
                )}
            </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}

// Helper icon
import { Settings2 } from 'lucide-react';
