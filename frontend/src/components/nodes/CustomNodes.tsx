import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare, Box, FileText, Split, Code, FileOutput, FileEdit, Image, Video, Circle } from 'lucide-react';

const BaseNode = ({ data, selected, icon: Icon, color = 'bg-white', label }: any) => {
  return (
    <div className={`shadow-md rounded-xl bg-white border-2 min-w-[150px] transition-all ${selected ? 'border-blue-500 shadow-blue-100' : 'border-slate-200'}`}>
      <div className={`p-2 border-b border-slate-100 flex items-center gap-2 rounded-t-xl ${color}`}>
        <div className="p-1 bg-white/50 rounded shadow-sm">
            <Icon className="w-3.5 h-3.5 text-slate-700" />
        </div>
        <div className="text-xs font-semibold text-slate-700">{label}</div>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-slate-800">{data.label}</div>
        {data.description && <div className="text-[10px] text-slate-400 mt-1">{data.description}</div>}
      </div>
      
      <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-slate-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-blue-500 !border-2 !border-white" />
    </div>
  );
};

export const LLMNode = memo((props: NodeProps) => <BaseNode {...props} icon={MessageSquare} label="LLM 大模型" color="bg-blue-50" />);
export const RetrieverNode = memo((props: NodeProps) => <BaseNode {...props} icon={FileText} label="知识库检索" color="bg-orange-50" />);
export const PythonNode = memo((props: NodeProps) => <BaseNode {...props} icon={Code} label="Python 脚本" color="bg-green-50" />);
export const ConditionNode = memo((props: NodeProps) => <BaseNode {...props} icon={Split} label="条件判断" color="bg-purple-50" />);
export const EndNode = memo((props: NodeProps) => (
    <div className={`shadow-md rounded-full w-16 h-16 flex items-center justify-center bg-slate-900 border-4 ${props.selected ? 'border-blue-500' : 'border-white'}`}>
        <div className="text-xs font-bold text-white">结束</div>
        <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-slate-400 !border-2 !border-white" />
    </div>
));

// Export all custom node types
export const nodeTypes = {
  llm: LLMNode,
  retriever: RetrieverNode,
  script: PythonNode,
  condition: ConditionNode,
  end: EndNode,
};
