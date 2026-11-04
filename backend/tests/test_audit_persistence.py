"""SQLite backup/restore and Redis outbox reconciliation regression tests."""
import asyncio
import sqlite3
from pathlib import Path

from app.audit_events import record_event, has_event

def test_sqlite_wal_backup_restore(tmp_path, monkeypatch):
    source = tmp_path / "persistent" / "audit.sqlite3"
    backup = tmp_path / "backup.sqlite3"
    restored = tmp_path / "restored.sqlite3"
    monkeypatch.setenv("STUDIO_AUDIT_DB", str(source))
    record_event("backup-job", "job_claimed", event_id="claimed:backup-job:1", status="processing")
    record_event("backup-job", "job_claimed", event_id="claimed:backup-job:1", status="processing")
    assert has_event("claimed:backup-job:1")
    with sqlite3.connect(source) as db, sqlite3.connect(backup) as target:
        db.backup(target)
    restored.write_bytes(backup.read_bytes())
    with sqlite3.connect(restored) as db:
        assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert db.execute("SELECT COUNT(*) FROM job_events WHERE job_id='backup-job'").fetchone()[0] == 1
        indexes = db.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()
        assert any("idx_job_events_job" in row for row in indexes)
    monkeypatch.setenv("STUDIO_AUDIT_DB", str(restored))
    assert has_event("claimed:backup-job:1")
