"""SQLite audit events for a dedicated BC Book Studio staging volume.

Not a distributed transaction with Redis. Reconcile Redis state after crash.
"""
import json
import os
import sqlite3
import time
import uuid
from pathlib import Path

def audit_path():
    value = os.getenv("STUDIO_AUDIT_DB")
    if not value:
        raise RuntimeError("STUDIO_AUDIT_DB must point to a persistent project-owned volume")
    return Path(value)

def record_event(job_id, event_type, *, worker_id="", attempt=0, metadata=None,
                 status="", error_category="", output_ref="", duration_ms=0):
    path = audit_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path, timeout=15) as db:
        db.execute("PRAGMA busy_timeout=15000")
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("""CREATE TABLE IF NOT EXISTS job_events (
            event_id TEXT PRIMARY KEY, job_id TEXT NOT NULL, event_type TEXT NOT NULL,
            timestamp REAL NOT NULL, worker_id TEXT, attempt_number INTEGER,
            agent_name TEXT, prompt_version TEXT, knowledge_version TEXT,
            knowledge_hashes TEXT, provider TEXT, model TEXT, status TEXT,
            error_category TEXT, duration_ms INTEGER, approval_status TEXT,
            output_ref TEXT)""")
        db.execute("CREATE INDEX IF NOT EXISTS idx_job_events_job ON job_events(job_id, timestamp)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_job_events_time ON job_events(timestamp)")
        meta = metadata or {}
        docs = meta.get("knowledge_documents", [])
        db.execute("""INSERT INTO job_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (uuid.uuid4().hex, job_id, event_type, time.time(), worker_id, attempt,
             meta.get("agent", ""), meta.get("prompt_version", ""),
             meta.get("knowledge_version", ""),
             json.dumps([{"name": d.get("name"), "sha256": d.get("sha256")} for d in docs]),
             meta.get("provider", ""), meta.get("model", ""), status,
             error_category, duration_ms, meta.get("human_approval", "belum_disetujui"),
             output_ref))
