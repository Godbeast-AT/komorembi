from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class ProjectRecord:
    project_id: str
    status: str
    created_at: str
    updated_at: str
    brief: str
    tier: str
    client_name: Optional[str]
    error: Optional[str] = None
    brand_kit: Optional[Dict[str, Any]] = None
    pdf_path: Optional[str] = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ProjectStore:
    def __init__(self, base_dir: str | Path):
        self.base_dir = Path(base_dir)
        self.projects_dir = self.base_dir / "projects"
        self.projects_dir.mkdir(parents=True, exist_ok=True)

    def _project_json_path(self, project_id: str) -> Path:
        return self.projects_dir / f"{project_id}.json"

    def _project_pdf_path(self, project_id: str) -> Path:
        return self.projects_dir / f"{project_id}.pdf"

    def create(self, *, project_id: str, brief: str, tier: str, client_name: Optional[str]) -> ProjectRecord:
        now = _utc_now_iso()
        record = ProjectRecord(
            project_id=project_id,
            status="queued",
            created_at=now,
            updated_at=now,
            brief=brief,
            tier=tier,
            client_name=client_name,
        )
        self._write(record)
        return record

    def get(self, project_id: str) -> Optional[ProjectRecord]:
        path = self._project_json_path(project_id)
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return ProjectRecord(**data)

    def update(
        self,
        project_id: str,
        *,
        status: Optional[str] = None,
        error: Optional[str] = None,
        brand_kit: Optional[Dict[str, Any]] = None,
        pdf_bytes: Optional[bytes] = None,
    ) -> ProjectRecord:
        existing = self.get(project_id)
        if existing is None:
            raise KeyError(project_id)

        updated = ProjectRecord(
            project_id=existing.project_id,
            status=status or existing.status,
            created_at=existing.created_at,
            updated_at=_utc_now_iso(),
            brief=existing.brief,
            tier=existing.tier,
            client_name=existing.client_name,
            error=error if error is not None else existing.error,
            brand_kit=brand_kit if brand_kit is not None else existing.brand_kit,
            pdf_path=str(self._project_pdf_path(project_id)) if (pdf_bytes is not None) else existing.pdf_path,
        )

        if pdf_bytes is not None:
            self._project_pdf_path(project_id).write_bytes(pdf_bytes)

        self._write(updated)
        return updated

    def read_pdf(self, project_id: str) -> Optional[bytes]:
        record = self.get(project_id)
        if record is None or not record.pdf_path:
            return None
        pdf_path = Path(record.pdf_path)
        if not pdf_path.exists():
            return None
        return pdf_path.read_bytes()

    def _write(self, record: ProjectRecord) -> None:
        path = self._project_json_path(record.project_id)
        path.write_text(json.dumps(record.__dict__, indent=2, ensure_ascii=False), encoding="utf-8")


def default_store_dir() -> Path:
    env = os.getenv("AI_AGENCY_DATA_DIR")
    if env:
        return Path(env)
    return Path(__file__).resolve().parent.parent / "data"

