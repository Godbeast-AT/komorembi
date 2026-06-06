from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Tier(str, Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class BrandDNA(BaseModel):
    voice: str = Field(..., description="Brand personality")
    tone: str = Field(..., description="Communication style")
    colors: List[str] = Field(default_factory=list, description="Hex color palette")
    typography: str = Field(default="Inter", description="Font family")
    keywords: List[str] = Field(default_factory=list)


class ProjectRequest(BaseModel):
    brief: str = Field(..., min_length=10)
    tier: Tier = Tier.PROFESSIONAL
    client_name: Optional[str] = None


class ProjectCreateResponse(BaseModel):
    stripe_session_id: Optional[str] = None
    stripe_checkout_url: Optional[str] = None
    project_id: str
    status: str
    estimated_ready: str


class ProjectStatusResponse(BaseModel):
    project_id: str
    status: str
    error: Optional[str] = None
    download_url: Optional[str] = None
    brand_kit: Optional[dict] = None

