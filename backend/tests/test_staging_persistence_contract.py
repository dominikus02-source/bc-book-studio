"""Staging deployment contract: durable project-owned audit volume, AOF, no auto publish."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def test_staging_worker_has_durable_audit_volume():
    text = (ROOT / "compose.staging.yml").read_text(encoding="utf-8")
    worker = text.split("\n  worker:", 1)[1].split("\n  postgres:", 1)[0]
    assert "STUDIO_AUDIT_DB: /var/lib/bc-book-studio/audit/audit.sqlite3" in worker
    assert "studio_audit_data:/var/lib/bc-book-studio/audit" in worker
    assert "audit-init: { condition: service_completed_successfully }" in worker
    assert "chown 10001:10001 /audit" in text
    assert "chmod 0700 /audit" in text
    assert "\n  studio_audit_data:" in text
    assert "studio_audit_data" not in text.split("\n  worker:",1)[0]

def test_staging_redis_aof_volume_contract():
    text = (ROOT / "compose.staging.yml").read_text(encoding="utf-8")
    redis = text.split("\n  redis:", 1)[1].split("\nvolumes:", 1)[0]
    assert '"--appendonly","yes"' in redis
    assert '"--appendfsync","everysec"' in redis
    assert "redis_data:/data" in redis

def test_no_automatic_publishing_from_worker():
    source = (ROOT / "backend/app/worker.py").read_text(encoding="utf-8")
    assert "'waiting_approval'" in source
    assert "studio:result:" in source
