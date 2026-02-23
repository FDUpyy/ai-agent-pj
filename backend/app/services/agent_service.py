import os
from typing import List, Optional, TypedDict

import yaml
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from app.services.rag_service import RAGService


class AgentState(TypedDict):
    messages: List[BaseMessage]
    mentions: Optional[List[str]]


class AgentService:
    def __init__(self) -> None:
        self.config = self._load_config()
        self._init_llm()
        self.rag_service = RAGService()
        self._build_graph()

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
        
        # Priority: Env Var > Config > Default
        model_name = os.getenv("LLM_MODEL")
        if not model_name:
             model_settings = self.config.get("model_settings", {})
             model_name = model_settings.get("model") or "gpt-4o-mini"

        model_settings = self.config.get("model_settings", {})
        temperature = model_settings.get("temperature", 0.7)

        print(f"Initializing ChatOpenAI with model: {model_name}")
        self.llm = ChatOpenAI(
            model=model_name,
            api_key=api_key or None,
            base_url=base_url or None,
            temperature=temperature,
        )

    def _build_graph(self):
        graph = StateGraph(AgentState)
        graph.add_node("rewrite", self._rewrite_node)
        graph.add_node("retrieve", self._retrieve_node)
        graph.add_node("generate", self._generate_node)
        
        # If mentions are present, skip rewrite and go straight to retrieve with filter
        graph.set_conditional_entry_point(
            self._route_start,
            {
                "rewrite": "rewrite",
                "retrieve": "retrieve",
            }
        )
        
        graph.add_edge("rewrite", "retrieve")
        graph.add_edge("retrieve", "generate")
        graph.add_edge("generate", END)
        self.app = graph.compile()

    def _route_start(self, state: AgentState):
        if state.get("mentions") and len(state["mentions"]) > 0:
            print("Mentions detected, routing directly to Retrieve")
            return "retrieve"
        return "rewrite"

    def reload_config(self):
        self.config = self._load_config()
        self._init_llm()

    def _last_human(self, state: AgentState) -> Optional[HumanMessage]:
        for message in reversed(state["messages"]):
            if isinstance(message, HumanMessage):
                return message
        return None

    def _is_ambiguous(self, text: str) -> bool:
        lowered = text.lower()
        markers = [
            "那个",
            "刚才",
            "前面",
            "上面",
            "这里",
            "那里",
            "那个视频",
            "那个音频",
            "那段视频",
            "那段音频",
        ]
        for marker in markers:
            if marker in text:
                return True
        return False

    def _rewrite_node(self, state: AgentState) -> AgentState:
        last_human = self._last_human(state)
        if not last_human:
            return state
        if not self._is_ambiguous(last_human.content):
            return state
        system = SystemMessage(
            content=(
                "你是查询改写助手。用户的问题可能比较模糊，例如提到“那个视频”"
                "或“刚才的音频”。请结合对话上下文，将最后一条用户消息改写成"
                "更清晰、可检索的问题，例如补充文件名、类型或时间区间。"
                "只返回改写后的问题，不要添加其它说明。"
            )
        )
        rewritten = self.llm.invoke([system] + state["messages"])
        new_messages: List[BaseMessage] = []
        for message in state["messages"]:
            if message is last_human:
                new_messages.append(HumanMessage(content=rewritten.content))
            else:
                new_messages.append(message)
        return {"messages": new_messages}

    def _retrieve_node(self, state: AgentState) -> AgentState:
        last_human = self._last_human(state)
        if not last_human:
            return state
        
        rag_settings = self.config.get("rag_settings", {})
        top_k = rag_settings.get("top_k", 5)
        mentions = state.get("mentions")
        
        print(f"Retrieving context for user query: {last_human.content}, mentions: {mentions}")
        docs = self.rag_service.query(last_human.content, top_k=top_k, filter_kb_ids=mentions)
        print("Context found:", len(docs), "documents")
        
        context_parts = []
        # Add system hint if precise routing was used
        if mentions:
            context_parts.append("[系统提示：以下是从用户明确指定参考的知识库中匹配到的最相关内容，请重点参考]")
            
        for doc in docs:
            meta = doc.metadata or {}
            source = meta.get("source")
            page = meta.get("page")
            start = meta.get("start")
            end = meta.get("end")
            prefix = ""
            if page is not None:
                prefix = f"[Page {page}] "
            elif start is not None and end is not None:
                prefix = f"[{start:.2f}-{end:.2f}] "
            elif source:
                prefix = f"[Source] "
            context_parts.append(prefix + doc.page_content)
        context = "\n\n".join(context_parts)

        # Load prompt template from config or use default
        prompt_template = self.config.get("agent_prompt", "")
        if not prompt_template:
             # Fallback default
             prompt_template = (
                "你是一个智能助手。\n\n"
                "【重要】你拥有读取本地知识库的能力。以下是从知识库中检索到的相关上下文 (Context)：\n"
                "---------------------\n"
                "{{context}}\n"
                "---------------------\n\n"
                "请基于上述上下文回答用户的问题。\n"
             )
        
        system_content = prompt_template.replace("{{context}}", context)
        system = SystemMessage(content=system_content)
        return {"messages": state["messages"] + [system]}

    def _generate_node(self, state: AgentState) -> AgentState:
        response = self.llm.invoke(state["messages"])
        return {"messages": state["messages"] + [response]}

    async def chat_stream(self, message: str, mentions: Optional[List[str]] = None):
        initial_state: AgentState = {
            "messages": [HumanMessage(content=message)],
            "mentions": mentions
        }
        async for event in self.app.astream_events(initial_state, version="v1"):
            kind = event.get("event")
            if kind != "on_chat_model_stream":
                continue
            data = event.get("data") or {}
            chunk = data.get("chunk")
            if chunk is None:
                continue
            content = getattr(chunk, "content", "")
            if not content:
                continue
            if isinstance(content, str):
                yield content
            else:
                parts = []
                for item in content:
                    if isinstance(item, str):
                        parts.append(item)
                    else:
                        parts.append(str(item))
                text = "".join(parts)
                if text:
                    yield text
