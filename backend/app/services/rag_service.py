import os
from typing import List, Optional

os.environ.setdefault("ANONYMIZED_TELEMETRY", "FALSE")

import jieba
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from rank_bm25 import BM25Okapi

from app.utils.parser import UniversalParser


class RAGService:
    def __init__(self, persist_directory: Optional[str] = None) -> None:
        backend_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..")
        )
        default_dir = os.path.join(backend_dir, "chroma_db")
        self.persist_directory = persist_directory or default_dir
        os.makedirs(self.persist_directory, exist_ok=True)
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self.vectorstore = None
        if os.listdir(self.persist_directory):
            self.vectorstore = Chroma(
                embedding_function=self.embeddings,
                persist_directory=self.persist_directory,
            )
        self.parser = UniversalParser()
        self.bm25 = None
        self.bm25_docs: List[Document] = []
        self.bm25_tokens: List[List[str]] = []
        self.reranker = None
        try:
            from sentence_transformers import CrossEncoder

            self.reranker = CrossEncoder("BAAI/bge-reranker-base", device="cpu")
        except Exception:
            self.reranker = None

    def split_documents(
        self,
        docs: List[Document],
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        split_method: str = "token",
    ) -> List[Document]:
        # Currently we only support RecursiveCharacterTextSplitter
        # split_method can be extended later (e.g. 'regex', 'markdown', etc.)
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )
        return splitter.split_documents(docs)

    def ingest_file(
        self,
        file_path: str,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        split_method: str = "token",
        kb_id: Optional[str] = None,
        preview_only: bool = False,
    ) -> List[Document]:
        docs = self.parser.parse_file(file_path)
        if not docs:
            return []
            
        # Add kb_id to metadata
        if kb_id:
            for doc in docs:
                doc.metadata["kb_id"] = kb_id
        
        split_docs = self.split_documents(
            docs,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            split_method=split_method,
        )
        
        if not split_docs:
            return []
            
        if preview_only:
            return split_docs

        if self.vectorstore is None:
            self.vectorstore = Chroma.from_documents(
                split_docs,
                embedding=self.embeddings,
                persist_directory=self.persist_directory,
            )
        else:
            self.vectorstore.add_documents(split_docs)
        self.vectorstore.persist()
        
        # Update BM25 index
        for doc in split_docs:
            tokens = jieba.lcut(doc.page_content)
            if not tokens:
                continue
            self.bm25_tokens.append(tokens)
            self.bm25_docs.append(doc)
        if self.bm25_tokens:
            self.bm25 = BM25Okapi(self.bm25_tokens)
            
        return split_docs

    def _ensure_vectorstore(self) -> None:
        if self.vectorstore is not None:
            return
        if not os.listdir(self.persist_directory):
            return
        self.vectorstore = Chroma(
            embedding_function=self.embeddings,
            persist_directory=self.persist_directory,
        )

    def delete_kb_docs(self, kb_id: str):
        """Delete all documents associated with a specific knowledge base"""
        self._ensure_vectorstore()
        if self.vectorstore:
            # Chroma delete by filter
            # Note: collection.delete(where={"kb_id": kb_id})
            try:
                self.vectorstore._collection.delete(where={"kb_id": kb_id})
                self.vectorstore.persist()
            except Exception as e:
                print(f"Error deleting documents for kb_id {kb_id}: {e}")
        
        # Also clean up BM25 index (this is in-memory, so it's partial, but better than nothing)
        # Rebuilding BM25 completely is expensive, for now we just filter search results
        # Ideally we should rebuild or remove from list.
        # Simple removal:
        if self.bm25_docs:
            new_docs = []
            new_tokens = []
            for i, doc in enumerate(self.bm25_docs):
                if doc.metadata.get("kb_id") != kb_id:
                    new_docs.append(doc)
                    new_tokens.append(self.bm25_tokens[i])
            self.bm25_docs = new_docs
            self.bm25_tokens = new_tokens
            if self.bm25_tokens:
                self.bm25 = BM25Okapi(self.bm25_tokens)
            else:
                self.bm25 = None

    def get_kb_chunks(self, kb_id: str) -> List[str]:
        """Get all chunks for a specific knowledge base (simple retrieval)"""
        self._ensure_vectorstore()
        if not self.vectorstore:
            return []
        
        # Chroma get with filter
        try:
            results = self.vectorstore._collection.get(where={"kb_id": kb_id})
            return results.get("documents", [])
        except Exception as e:
            print(f"Error fetching chunks for kb_id {kb_id}: {e}")
            return []

    def hybrid_search(
        self, query_text: str, top_k: int = 5, filter_kb_ids: Optional[List[str]] = None
    ) -> List[Document]:
        self._ensure_vectorstore()
        candidates = {}

        def key_for(doc: Document) -> str:
            source = str(doc.metadata.get("source", ""))
            page = str(doc.metadata.get("page", ""))
            start = str(doc.metadata.get("start", ""))
            end = str(doc.metadata.get("end", ""))
            return "|".join([source, page, start, end])
            
        # Build filter for Chroma
        search_kwargs = {"k": max(top_k * 2, top_k)}
        if filter_kb_ids:
            if len(filter_kb_ids) == 1:
                search_kwargs["filter"] = {"kb_id": filter_kb_ids[0]}
            else:
                search_kwargs["filter"] = {"kb_id": {"$in": filter_kb_ids}}

        if self.vectorstore is not None:
            vector_docs = self.vectorstore.similarity_search(
                query_text, **search_kwargs
            )
            for index, doc in enumerate(vector_docs):
                key = key_for(doc)
                entry = candidates.get(key)
                if entry is None:
                    candidates[key] = {
                        "doc": doc,
                        "vector_rank": index,
                        "bm25_rank": None,
                    }
                else:
                    entry["vector_rank"] = min(
                        entry["vector_rank"], index
                    )
        
        # BM25 currently doesn't support efficient filtering in this simple implementation
        # For now, we rely on Vector Search for filtering, or we filter BM25 results manually
        # Manual filtering for BM25:
        if self.bm25 is not None and self.bm25_docs:
            tokens = jieba.lcut(query_text)
            scores = self.bm25.get_scores(tokens)
            indices = list(range(len(scores)))
            indices.sort(key=lambda i: scores[i], reverse=True)
            
            # Get more candidates to allow for filtering
            limit = min(len(indices), max(top_k * 10, 100)) 
            
            bm25_count = 0
            for idx in indices[:limit]:
                doc = self.bm25_docs[idx]
                
                # Manual Filter Check
                if filter_kb_ids:
                    doc_kb_id = doc.metadata.get("kb_id")
                    if doc_kb_id not in filter_kb_ids:
                        continue
                        
                key = key_for(doc)
                entry = candidates.get(key)
                if entry is None:
                    candidates[key] = {
                        "doc": doc,
                        "vector_rank": None,
                        "bm25_rank": bm25_count,
                    }
                else:
                    entry["bm25_rank"] = min(
                        entry["bm25_rank"], bm25_count
                    ) if entry["bm25_rank"] is not None else bm25_count
                
                bm25_count += 1
                if bm25_count >= max(top_k * 2, top_k):
                    break

        if not candidates:
            return []
            
        k_rrf = 60.0
        scored = []
        for entry in candidates.values():
            score = 0.0
            vrank = entry["vector_rank"]
            brank = entry["bm25_rank"]
            if vrank is not None:
                score += 0.6 * (1.0 / (k_rrf + vrank + 1.0))
            if brank is not None:
                score += 0.4 * (1.0 / (k_rrf + brank + 1.0))
            scored.append((score, entry["doc"]))
        scored.sort(key=lambda item: item[0], reverse=True)
        docs = [item[1] for item in scored]
        
        if self.reranker is not None and docs:
            candidate_count = min(len(docs), max(top_k * 2, 10))
            subset = docs[:candidate_count]
            pairs = [(query_text, d.page_content) for d in subset]
            try:
                scores = self.reranker.predict(pairs)
                combined = list(zip(subset, scores))
                combined.sort(key=lambda item: float(item[1]), reverse=True)
                reranked_docs = [item[0] for item in combined][:top_k]
                return reranked_docs
            except Exception:
                return docs[:top_k]
        return docs[:top_k]

    def query(
        self, query_text: str, top_k: int = 3, filter_kb_ids: Optional[List[str]] = None
    ) -> List[Document]:
        return self.hybrid_search(query_text, top_k=top_k, filter_kb_ids=filter_kb_ids)
