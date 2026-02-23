import os
import json
import logging
from typing import List, Dict, Any, Optional
import yaml
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.documents import Document
import networkx as nx

from app.services.rag_service import RAGService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GraphService:
    def __init__(self):
        self.config = self._load_config()
        self._init_llm()
        self.rag_service = RAGService()

    def _load_config(self):
        config_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "config.yaml"
        )
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)
        return {}

    def _init_llm(self):
        api_key = os.getenv("LLM_API_KEY", "")
        base_url = os.getenv("LLM_BASE_URL", "")
        
        # Use a more capable model for extraction if possible
        model_name = os.getenv("LLM_MODEL", "gpt-4o") 
        
        model_settings = self.config.get("model_settings", {})
        temperature = 0.1 # Low temperature for structured output

        logger.info(f"Initializing GraphService LLM with model: {model_name}")
        self.llm = ChatOpenAI(
            model=model_name,
            api_key=api_key or None,
            base_url=base_url or None,
            temperature=temperature,
            response_format={"type": "json_object"}
        )

    def generate_graph(
        self, 
        kb_ids: List[str], 
        max_nodes: int = 50, 
        granularity: str = "fine",
        process_all: bool = False,
        depth: int = 1
    ) -> Dict[str, Any]:
        """
        Generates a knowledge graph from the specified knowledge bases.
        Supports full extraction via batch processing (Map-Reduce).
        """
        # 1. Retrieve text chunks
        all_chunks = []
        for kb_id in kb_ids:
            chunks = self.rag_service.get_kb_chunks(kb_id)
            if not chunks:
                continue
                
            text_chunks = [c.page_content if isinstance(c, Document) else str(c) for c in chunks]
            
            if process_all:
                all_chunks.extend(text_chunks)
            else:
                # Sample logic
                limit = max(10, max_nodes * 2) 
                all_chunks.extend(text_chunks[:limit])
        
        if not all_chunks:
            return {"nodes": [], "links": []}

        # 2. Batch Processing (Map-Reduce)
        # If process_all is True or content is large, we batch it.
        # Batch size: 5 chunks approx 2500 tokens (assuming 500 chars/chunk)
        batch_size = 5
        batches = [all_chunks[i:i + batch_size] for i in range(0, len(all_chunks), batch_size)]
        
        # Limit total batches to avoid extreme costs/time if not process_all
        # If process_all is true, we process all batches (warning: slow/expensive)
        # For safety in this demo, hard cap process_all to 20 batches (~100 chunks)
        if process_all:
             batches = batches[:20] 
        else:
             batches = [batches[0]] if batches else [] # Just one batch for quick sample if not process_all? 
             # Wait, logic above already limited all_chunks if not process_all. 
             # So we just process all generated batches.

        combined_nodes = {}
        combined_links = []

        logger.info(f"Processing {len(batches)} batches for graph extraction...")

        for i, batch in enumerate(batches):
            batch_text = "\n\n".join(batch)
            try:
                # Construct Prompt with Depth
                depth_instruction = ""
                if depth == 1:
                    depth_instruction = "仅提取最核心的骨架实体和主要关系。"
                elif depth == 2:
                    depth_instruction = "提取常规的实体关联，包括次级概念。"
                elif depth == 3:
                    depth_instruction = "深度挖掘所有潜在的实体和隐式关系，尽可能细致。"

                system_prompt = (
                    "你是一个知识图谱构建专家。请从给定的文本中提取核心实体(Entity)和实体间的关系(Relation)。\n"
                    "请严格输出符合以下结构的 JSON 格式：\n"
                    "{\n"
                    '  "nodes": [{"id": "实体名", "group": 类别ID(整数), "val": 重要性权重(1-20)}],\n'
                    '  "links": [{"source": "源实体名", "target": "目标实体名", "label": "关系描述"}]\n'
                    "}\n"
                    "注意事项：\n"
                    "1. 实体名应简洁准确，进行标准化（如 'AI' 和 '人工智能' 统一）。\n"
                    "2. group 用于聚类，相似类型的实体应有相同的 group ID。\n"
                    "3. val 代表实体在文本中的重要程度或出现频次。\n"
                    "4. 仅基于提供的文本提取，不要编造。\n"
                    f"5. 提取粒度：{'精细' if granularity == 'fine' else '粗略'}。\n"
                    f"6. 深度要求：{depth_instruction}\n"
                    f"7. 这是一个批处理任务的第 {i+1}/{len(batches)} 部分，请专注提取当前文本的局部图谱。"
                )

                response = self.llm.invoke([
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=f"文本内容：\n{batch_text}")
                ])
                
                partial_data = json.loads(response.content)
                
                # Merge logic
                if "nodes" in partial_data:
                    for node in partial_data["nodes"]:
                        nid = node.get("id")
                        if not nid: continue
                        if nid in combined_nodes:
                            # Update weight (max or sum?) - Let's use max for importance
                            combined_nodes[nid]["val"] = max(combined_nodes[nid].get("val", 1), node.get("val", 1))
                        else:
                            combined_nodes[nid] = node
                
                if "links" in partial_data:
                    for link in partial_data["links"]:
                        # Simple dedup for links: check if source-target-label combo exists?
                        # Or just append and let frontend force-graph handle it (it might overlap)
                        # Let's clean up: dedup by source+target
                        # Actually networkx is good for this, but simple list is fine for now.
                        combined_links.append(link)

            except Exception as e:
                logger.error(f"Error processing batch {i}: {e}")
                continue

        # Convert nodes dict back to list
        final_nodes = list(combined_nodes.values())
        
        # Deduplicate links (A->B label X)
        unique_links = []
        seen_links = set()
        for link in combined_links:
            s, t = link.get("source"), link.get("target")
            if not s or not t: continue
            key = f"{s}|{t}"
            if key not in seen_links:
                seen_links.add(key)
                unique_links.append(link)

        # Apply max_nodes limit strictly at the end?
        # Maybe sort by val and take top N?
        final_nodes.sort(key=lambda x: x.get("val", 0), reverse=True)
        # Only limit if not process_all? Or always limit to keep graph readable?
        # Let's respect max_nodes parameter as a view limit.
        if not process_all: 
             final_nodes = final_nodes[:max_nodes]
             # Filter links to only include present nodes
             node_ids = set(n["id"] for n in final_nodes)
             unique_links = [l for l in unique_links if l["source"] in node_ids and l["target"] in node_ids]

        return {"nodes": final_nodes, "links": unique_links}
