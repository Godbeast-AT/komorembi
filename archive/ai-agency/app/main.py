from __future__ import annotations

import io
import os
import uuid
from typing import Optional

import stripe
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .models import ProjectCreateResponse, ProjectRequest, ProjectStatusResponse
from .storage import ProjectStore, default_store_dir
from .workflows import run_project_pipeline


load_dotenv()

app = FastAPI(title="AI Agency API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


TIERS = {
    "starter": {"price_cents": 2900, "features": "Basic content + logo"},
    "professional": {"price_cents": 9900, "features": "Content + brand kit + PDF"},
    "enterprise": {"price_cents": 29900, "features": "Customization + priority"},
}


def _public_base_url() -> str:
    return os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")


def _stripe_enabled() -> bool:
    return os.getenv("STRIPE_ENABLED", "false").lower() in {"1", "true", "yes", "on"}


store = ProjectStore(default_store_dir())


def _create_stripe_checkout_session(*, tier: str, project_id: str) -> tuple[Optional[str], Optional[str]]:
    if not _stripe_enabled():
        return None, None

    secret = os.getenv("STRIPE_SECRET_KEY")
    if not secret:
        return None, None

    stripe.api_key = secret
    success_url = f"{_public_base_url()}/success?project_id={project_id}&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{_public_base_url()}/cancel?project_id={project_id}"

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"AI Agency Project - {tier}"},
                    "unit_amount": TIERS[tier]["price_cents"],
                },
                "quantity": 1,
            }
        ],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"project_id": project_id, "tier": tier},
    )

    return session.id, session.url


@app.post("/api/v1/projects", response_model=ProjectCreateResponse)
async def create_project(request: ProjectRequest, background: BackgroundTasks):
    tier = request.tier.value
    if tier not in TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")

    project_id = str(uuid.uuid4())
    store.create(project_id=project_id, brief=request.brief, tier=tier, client_name=request.client_name)

    session_id, checkout_url = _create_stripe_checkout_session(tier=tier, project_id=project_id)

    # Note: In production you'd gate generation on Stripe webhook payment success.
    background.add_task(run_project_pipeline, project_id, request.brief, tier, request.client_name)

    return ProjectCreateResponse(
        stripe_session_id=session_id,
        stripe_checkout_url=checkout_url,
        project_id=project_id,
        status="queued",
        estimated_ready="~2-5 minutes",
    )


@app.get("/api/v1/projects/{project_id}", response_model=ProjectStatusResponse)
async def get_project_status(project_id: str):
    record = store.get(project_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Not found")

    download_url = None
    if record.status == "ready":
        download_url = f"{_public_base_url()}/api/v1/projects/{project_id}/download"

    return ProjectStatusResponse(
        project_id=record.project_id,
        status=record.status,
        error=record.error,
        download_url=download_url,
        brand_kit=record.brand_kit,
    )


@app.get("/api/v1/projects/{project_id}/download")
async def download_project(project_id: str):
    pdf = store.read_pdf(project_id)
    if pdf is None:
        raise HTTPException(status_code=404, detail="PDF not ready")
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={project_id}.pdf"},
    )


@app.get("/health")
async def health():
    return {"ok": True}

