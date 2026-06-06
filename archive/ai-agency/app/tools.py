from __future__ import annotations

import io
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
from PIL import Image as PILImage, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer

from .models import BrandDNA


@dataclass(frozen=True)
class ImageAsset:
    kind: str  # "logo" | "photo"
    path: str


def generate_placeholder_logo(brand: BrandDNA, client_name: str, out_path: str) -> str:
    img = PILImage.new("RGB", (1024, 1024), color=brand.colors[0] if brand.colors else "#111827")
    draw = ImageDraw.Draw(img)
    # Simple geometric mark + name (no fancy font dependencies)
    accent = brand.colors[1] if len(brand.colors) > 1 else "#2563eb"
    draw.ellipse((140, 140, 360, 360), outline=accent, width=18)
    draw.rectangle((390, 200, 884, 300), fill=accent)

    text = client_name[:24]
    try:
        font = ImageFont.truetype("arial.ttf", 56)
    except Exception:
        font = ImageFont.load_default()
    draw.text((140, 430), text, fill="white", font=font)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, format="PNG")
    return out_path


def generate_placeholder_photos(brand: BrandDNA, out_dir: str) -> List[str]:
    os.makedirs(out_dir, exist_ok=True)
    paths: List[str] = []
    for i in range(3):
        base = brand.colors[min(i, len(brand.colors) - 1)] if brand.colors else "#111827"
        accent = brand.colors[(i + 1) % len(brand.colors)] if len(brand.colors) > 1 else "#f59e0b"
        img = PILImage.new("RGB", (1024, 768), color=base)
        d = ImageDraw.Draw(img)
        d.polygon([(80, 680), (240, 200), (440, 680)], fill=accent)
        p = os.path.join(out_dir, f"photo_{i+1}.png")
        img.save(p, format="PNG")
        paths.append(p)
    return paths


def assemble_pdf(*, client_name: str, brand: BrandDNA, content: str, logo_path: str, photo_paths: List[str]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, title=f"{client_name} - Brand Kit")
    styles = getSampleStyleSheet()

    story: List[Any] = []
    if os.path.exists(logo_path):
        logo = Image(logo_path, width=96, height=96)
        logo.hAlign = "RIGHT"
        story.append(logo)

    story.append(Spacer(1, 12))
    story.append(Paragraph(client_name, styles["Heading1"]))
    story.append(Spacer(1, 12))

    palette = ", ".join(brand.colors) if brand.colors else "N/A"
    story.append(Paragraph(f"<b>Voice:</b> {brand.voice}", styles["Normal"]))
    story.append(Paragraph(f"<b>Tone:</b> {brand.tone}", styles["Normal"]))
    story.append(Paragraph(f"<b>Typography:</b> {brand.typography}", styles["Normal"]))
    story.append(Paragraph(f"<b>Colors:</b> {palette}", styles["Normal"]))
    if brand.keywords:
        story.append(Paragraph(f"<b>Keywords:</b> {', '.join(brand.keywords)}", styles["Normal"]))

    story.append(Spacer(1, 16))
    for para in content.split("\n\n"):
        story.append(Paragraph(para.replace("\n", "<br/>"), styles["BodyText"]))
        story.append(Spacer(1, 10))

    for p in photo_paths[:3]:
        if os.path.exists(p):
            story.append(Spacer(1, 10))
            story.append(Image(p, width=400, height=300))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


async def call_openai_json(prompt: str) -> Optional[Dict[str, Any]]:
    """
    Optional helper that uses OpenAI if OPENAI_API_KEY is set.
    Returns parsed JSON dict, or None on failure.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import AsyncOpenAI
    except Exception:
        return None

    client = AsyncOpenAI(api_key=api_key)
    resp = await client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": "Return ONLY valid JSON. No markdown."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )
    text = (resp.choices[0].message.content or "").strip()
    try:
        import json

        return json.loads(text)
    except Exception:
        return None


async def call_openai_text(prompt: str) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import AsyncOpenAI
    except Exception:
        return None
    client = AsyncOpenAI(api_key=api_key)
    resp = await client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return (resp.choices[0].message.content or "").strip() or None


async def call_anthropic_text(prompt: str) -> Optional[str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        from anthropic import AsyncAnthropic
    except Exception:
        return None
    client = AsyncAnthropic(api_key=api_key)
    msg = await client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest"),
        max_tokens=1200,
        temperature=0.7,
        messages=[{"role": "user", "content": prompt}],
    )
    # anthropic returns list of content blocks
    parts = []
    for block in msg.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    text = "\n".join(parts).strip()
    return text or None


async def optional_originality_signal(text: str) -> Optional[float]:
    """
    If you have an external scoring API, wire it here.
    This is intentionally NOT an 'AI detector bypass' loop.
    """
    url = os.getenv("QUALITY_SIGNAL_URL")
    token = os.getenv("QUALITY_SIGNAL_TOKEN")
    if not url or not token:
        return None
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(url, headers={"Authorization": f"Bearer {token}"}, json={"text": text})
        r.raise_for_status()
        data = r.json()
        score = data.get("score")
        return float(score) if score is not None else None

