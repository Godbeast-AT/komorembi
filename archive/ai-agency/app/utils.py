from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from .models import BrandDNA


_HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{3}){1,2}\b")


def extract_hex_colors(text: str) -> List[str]:
    seen = []
    for m in _HEX_RE.finditer(text):
        c = m.group(0).lower()
        if c not in seen:
            seen.append(c)
    return seen


def safe_json_loads(s: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(s)
    except Exception:
        return None


def fallback_brand_dna(brief: str) -> BrandDNA:
    colors = extract_hex_colors(brief)
    if not colors:
        colors = ["#111827", "#2563eb", "#f59e0b"]  # slate/blue/amber
    return BrandDNA(
        voice="Confident, helpful, practical",
        tone="Clear, concise, friendly",
        colors=colors[:5],
        typography="Inter",
        keywords=["quality", "trust", "simple", "modern"],
    )


def normalize_client_name(client_name: Optional[str], brief: str) -> str:
    if client_name and client_name.strip():
        return client_name.strip()
    # lightweight guess
    m = re.search(r"for\s+([A-Z][\w& -]{2,40})", brief)
    if m:
        return m.group(1).strip()
    return "Your Brand"

