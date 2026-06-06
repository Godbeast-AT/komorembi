from __future__ import annotations

from typing import Optional

from .models import BrandDNA
from .tools import call_anthropic_text, call_openai_json, call_openai_text
from .utils import fallback_brand_dna


async def strategist_extract_brand(brief: str) -> BrandDNA:
    prompt = f"""
You are a senior brand strategist.
From the brief below, extract a minimal Brand DNA JSON with keys:
voice (string), tone (string), colors (array of hex strings), typography (string), keywords (array of strings).
If the brief does not specify colors, propose up to 3 sensible colors.

Brief:
{brief}
""".strip()

    data = await call_openai_json(prompt)
    if not data:
        return fallback_brand_dna(brief)

    try:
        return BrandDNA.model_validate(data)
    except Exception:
        return fallback_brand_dna(brief)


async def writer_generate_content(brief: str, brand: BrandDNA, tier: str) -> str:
    length_hint = {
        "starter": "Write ~250-400 words.",
        "professional": "Write ~500-800 words.",
        "enterprise": "Write ~900-1300 words with extra detail and variations.",
    }.get(tier, "Write ~500-800 words.")

    prompt = f"""
You are a senior copywriter.
Write marketing copy that matches this Brand DNA exactly:
- Voice: {brand.voice}
- Tone: {brand.tone}
- Keywords: {", ".join(brand.keywords) if brand.keywords else "N/A"}

Output sections (use headings):
1) One-line positioning statement
2) Short homepage hero (headline + subheadline + 3 bullets)
3) About section
4) 3 social posts (each <= 280 chars)
5) Email (subject + body)

{length_hint}

Client brief:
{brief}
""".strip()

    text = await call_openai_text(prompt)
    if text:
        return text

    # Fallback: deterministic template
    kw = ", ".join(brand.keywords) if brand.keywords else "quality, trust, simple"
    return f"""## Positioning
Built for people who want {kw}—without the friction.

## Homepage hero
**A modern experience that feels effortless.**
{brief.strip()}

- Clear value in seconds
- Design aligned to your brand
- Built to convert and retain

## About
We help teams turn a clear story into consistent messaging and visuals. Expect a voice that sounds like you, a palette that feels intentional, and copy that moves.

## Social posts
1) New drop: the simplest way to get started—built for {kw}. Want a quick walkthrough?
2) If you’re tired of generic marketing, you’re not alone. Here’s what “brand-consistent” actually looks like.
3) Small changes compound: stronger headline, cleaner CTA, consistent tone. That’s the difference.

## Email
Subject: A simple way to level up your message

Hi there — quick note. If you’re building {brief.strip()}, we can help you clarify your story and present it consistently across pages, posts, and emails. Want a 10‑minute review?
"""


async def editor_polish(content: str, brand: BrandDNA) -> str:
    prompt = f"""
You are an editor-in-chief.
Polish the copy for clarity, specificity, and brand consistency.
Do NOT mention that you are AI. Do NOT add compliance claims you can't prove.
Keep the same structure and headings; improve flow and reduce repetition.

Brand DNA:
Voice: {brand.voice}
Tone: {brand.tone}

Copy:
{content}
""".strip()

    # Prefer Anthropic for editing if available; fallback to OpenAI; else return original
    edited = await call_anthropic_text(prompt)
    if edited:
        return edited
    edited2 = await call_openai_text(prompt)
    return edited2 or content

