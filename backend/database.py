import sqlite3
import os
from typing import List, Dict, Any, Optional
import json
import uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "app.db")

class Database:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                role TEXT,
                content TEXT,
                type TEXT DEFAULT 'text',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions (id)
            )
        """)

        # Create knowledge_bases table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_bases (
                id TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create agents table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT,
                nodes TEXT,
                edges TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # --- Session Methods ---

    def create_session(self, title: str = "New Chat") -> str:
        session_id = str(uuid.uuid4())
        conn = self.get_connection()
        conn.execute(
            "INSERT INTO sessions (id, title) VALUES (?, ?)",
            (session_id, title)
        )
        conn.commit()
        conn.close()
        return session_id

    def get_sessions(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.execute("SELECT * FROM sessions ORDER BY created_at DESC")
        sessions = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return sessions

    def get_session_messages(self, session_id: str) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,)
        )
        messages = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return messages

    def add_message(self, session_id: str, role: str, content: str, msg_type: str = "text") -> str:
        msg_id = f"{int(datetime.now().timestamp() * 1000)}-{role}"
        conn = self.get_connection()
        conn.execute(
            "INSERT INTO messages (id, session_id, role, content, type) VALUES (?, ?, ?, ?, ?)",
            (msg_id, session_id, role, content, msg_type)
        )
        # Update session title if it's the first user message
        if role == "user":
            cursor = conn.execute("SELECT count(*) as count FROM messages WHERE session_id = ?", (session_id,))
            count = cursor.fetchone()['count']
            if count <= 2: # System msg + first user msg
                # Simple title generation: truncate content
                new_title = content[:30] + ("..." if len(content) > 30 else "")
                conn.execute("UPDATE sessions SET title = ? WHERE id = ?", (new_title, session_id))
        
        conn.commit()
        conn.close()
        return msg_id

    def delete_session(self, session_id: str):
        conn = self.get_connection()
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
        conn.close()

    # --- Knowledge Base Methods ---

    def create_knowledge_base(self, name: str, description: str = "") -> str:
        kb_id = str(uuid.uuid4())
        created_at = datetime.now().isoformat()
        conn = self.get_connection()
        conn.execute(
            "INSERT INTO knowledge_bases (id, name, description, created_at) VALUES (?, ?, ?, ?)",
            (kb_id, name, description, created_at)
        )
        conn.commit()
        conn.close()
        return kb_id

    def get_knowledge_bases(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.execute("SELECT * FROM knowledge_bases ORDER BY created_at DESC")
        kbs = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return kbs

    def get_knowledge_base(self, kb_id: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.execute("SELECT * FROM knowledge_bases WHERE id = ?", (kb_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None

    def delete_knowledge_base(self, kb_id: str):
        conn = self.get_connection()
        conn.execute("DELETE FROM knowledge_bases WHERE id = ?", (kb_id,))
        conn.commit()
        conn.close()

    # --- Agent Methods ---

    def save_agent(self, name: str, nodes: List[Any], edges: List[Any], agent_id: Optional[str] = None) -> Dict[str, Any]:
        conn = self.get_connection()
        nodes_json = json.dumps(nodes)
        edges_json = json.dumps(edges)
        
        if agent_id:
            # Update
            conn.execute(
                "UPDATE agents SET name = ?, nodes = ?, edges = ?, updated_at = ? WHERE id = ?",
                (name, nodes_json, edges_json, datetime.now(), agent_id)
            )
        else:
            # Create
            agent_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO agents (id, name, nodes, edges) VALUES (?, ?, ?, ?)",
                (agent_id, name, nodes_json, edges_json)
            )
            
        conn.commit()
        conn.close()
        return {
            "id": agent_id,
            "name": name,
            "nodes": nodes,
            "edges": edges
        }

    def get_agents(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.execute("SELECT * FROM agents ORDER BY updated_at DESC")
        rows = cursor.fetchall()
        conn.close()
        
        agents = []
        for row in rows:
            agent = dict(row)
            try:
                agent["nodes"] = json.loads(agent["nodes"])
                agent["edges"] = json.loads(agent["edges"])
            except:
                agent["nodes"] = []
                agent["edges"] = []
            agents.append(agent)
        return agents

    def get_agent(self, agent_id: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            agent = dict(row)
            try:
                agent["nodes"] = json.loads(agent["nodes"])
                agent["edges"] = json.loads(agent["edges"])
            except:
                agent["nodes"] = []
                agent["edges"] = []
            return agent
        return None

db = Database()
