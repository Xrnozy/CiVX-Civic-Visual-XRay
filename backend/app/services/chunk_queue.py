"""Serial passive-video chunk queue — one GPU job at a time, survives restarts."""

from __future__ import annotations

import logging
import queue
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

_queue: ChunkProcessingQueue | None = None


class ChunkProcessingQueue:
    """Processes video chunks strictly one-after-another to avoid GPU OOM."""

    def __init__(self) -> None:
        self._pending: queue.Queue[str] = queue.Queue()
        self._seen: set[str] = set()
        self._lock = threading.Lock()
        self._worker: threading.Thread | None = None
        self._running = False
        self._current_chunk_id: str | None = None
        self._processed = 0
        self._failed = 0

    def start(self) -> None:
        with self._lock:
            if self._worker and self._worker.is_alive():
                return
            self._running = True
            self._worker = threading.Thread(
                target=self._run,
                daemon=True,
                name="passive-chunk-worker",
            )
            self._worker.start()
            logger.info("Passive chunk worker started (serial GPU processing)")

    def stop(self) -> None:
        self._running = False

    def enqueue(self, chunk_id: str) -> None:
        with self._lock:
            if chunk_id in self._seen:
                return
            self._seen.add(chunk_id)
        self._pending.put(chunk_id)
        logger.info("Chunk %s queued (depth ~%s)", chunk_id, self._pending.qsize())

    def recover_pending(self) -> int:
        """Re-queue pending chunks and reset stale 'processing' rows after crash."""
        from app.db import get_supabase

        sb = get_supabase()
        stale = (
            sb.table("video_chunks")
            .select("id")
            .eq("processing_status", "processing")
            .execute()
            .data
            or []
        )
        for row in stale:
            sb.table("video_chunks").update({"processing_status": "pending"}).eq("id", row["id"]).execute()
            logger.warning("Reset stale processing chunk %s → pending", row["id"])

        rows = (
            sb.table("video_chunks")
            .select("id")
            .eq("processing_status", "pending")
            .order("created_at")
            .execute()
            .data
            or []
        )
        for row in rows:
            self.enqueue(row["id"])
        logger.info("Recovered %s pending chunk(s) into queue", len(rows))
        return len(rows)

    def status(self) -> dict[str, Any]:
        return {
            "running": self._running,
            "queue_depth": self._pending.qsize(),
            "current_chunk_id": self._current_chunk_id,
            "processed_total": self._processed,
            "failed_total": self._failed,
        }

    def _run(self) -> None:
        from app.agents.passive_video import PassiveVideoAgent
        from app.db import get_supabase

        agent = PassiveVideoAgent()
        while self._running:
            try:
                chunk_id = self._pending.get(timeout=1.0)
            except queue.Empty:
                continue

            self._current_chunk_id = chunk_id
            t0 = time.perf_counter()
            try:
                agent.process_chunk(chunk_id)
                self._processed += 1
                logger.info(
                    "Chunk %s done in %.1fs (processed=%s failed=%s)",
                    chunk_id,
                    time.perf_counter() - t0,
                    self._processed,
                    self._failed,
                )
            except Exception:
                self._failed += 1
                logger.exception("Chunk %s failed", chunk_id)
                sb = get_supabase()
                sb.table("video_chunks").update({"processing_status": "failed"}).eq("id", chunk_id).execute()
            finally:
                self._current_chunk_id = None
                self._pending.task_done()

    @staticmethod
    def _release_gpu_memory() -> None:
        pass  # gpu_queue releases VRAM after each inference job


def get_chunk_queue() -> ChunkProcessingQueue:
    global _queue
    if _queue is None:
        _queue = ChunkProcessingQueue()
    return _queue
