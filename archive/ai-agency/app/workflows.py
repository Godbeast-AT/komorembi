from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Optional

from .agents import editor_polish, strategist_extract_brand, writer_generate_content
from .storage import ProjectStore, default_store_dir
from .tools import assemble_pdf, generate_placeholder_logo, generate_placeholder_photos
from .utils import normalize_client_name


def _assets_dir() -> Path:
    return default_store_dir() / "assets"


async def _execute_pipeline(*, brief: str, tier: str, client_name: Optional[str]) -> tuple[bytes, dict]:
    client = normalize_client_name(client_name, brief)
    brand = await strategist_extract_brand(brief)
    content = await writer_generate_content(brief, brand, tier)
    content = await editor_polish(content, brand)

    # Visuals: placeholder assets (swap to real generation later)
    assets_dir = _assets_dir()
    logo_path = str(assets_dir / f"{client.replace(' ', '_')}_logo.png")
    generate_placeholder_logo(brand, client, logo_path)
    photo_dir = str(assets_dir / f"{client.replace(' ', '_')}_photos")
    photos = generate_placeholder_photos(brand, photo_dir)

    pdf = assemble_pdf(client_name=client, brand=brand, content=content, logo_path=logo_path, photo_paths=photos)

    brand_kit = {
        "client_name": client,
        "brand_dna": brand.model_dump(),
        "assets": {"logo_path": logo_path, "photo_paths": photos},
    }
    return pdf, brand_kit


def run_project_pipeline(project_id: str, brief: str, tier: str, client_name: Optional[str]) -> None:
    """
    Called via FastAPI BackgroundTasks (sync). Runs the async pipeline and stores results.
    """
    store = ProjectStore(default_store_dir())
    store.update(project_id, status="running", error=None)
    try:
        pdf_bytes, brand_kit = asyncio.run(_execute_pipeline(brief=brief, tier=tier, client_name=client_name))
        store.update(project_id, status="ready", brand_kit=brand_kit, pdf_bytes=pdf_bytes, error=None)
    except Exception as e:
        store.update(project_id, status="error", error=str(e))

