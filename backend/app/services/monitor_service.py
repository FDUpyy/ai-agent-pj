import os
import threading
import time
from typing import Optional

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from app.services.rag_service import RAGService


class KBEventHandler(FileSystemEventHandler):
    def __init__(self, rag_service: RAGService):
        self.rag_service = rag_service

    def on_created(self, event):
        if not event.is_directory:
            print(f"New file detected in System KB: {event.src_path}")
            self.rag_service.ingest_file(os.path.abspath(event.src_path))

    def on_modified(self, event):
        if not event.is_directory:
            print(f"File modified in System KB: {event.src_path}")
            self.rag_service.ingest_file(os.path.abspath(event.src_path))


class MonitorService:
    def __init__(self, rag_service: RAGService):
        self.rag_service = rag_service
        self.observer: Optional[Observer] = None
        self.watch_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "data", "system_kb")
        )
        os.makedirs(self.watch_dir, exist_ok=True)

    def start(self):
        if self.observer:
            return

        print(f"Starting System KB monitor on: {self.watch_dir}")
        event_handler = KBEventHandler(self.rag_service)
        self.observer = Observer()
        self.observer.schedule(event_handler, self.watch_dir, recursive=False)
        self.observer.start()

    def stop(self):
        if self.observer:
            self.observer.stop()
            self.observer.join()
            self.observer = None
