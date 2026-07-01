# =====================================================================
#  Pydantic sxemalar — auth so'rov/javob modellari
# =====================================================================
from uuid import UUID
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class CompanyIn(BaseModel):
    name: str = Field(min_length=2)
    stir: str = Field(min_length=9, max_length=9, pattern=r"^\d{9}$")  # 9 raqam
    legal_form: Literal["mchj", "yatt", "qk", "aj", "other"] = "mchj"
    company_type: Literal["producer", "aggregator", "both"] = "producer"
    region: Optional[str] = None


class RegisterRequest(BaseModel):
    role: Literal["exporter", "importer"]
    name: str = Field(min_length=2)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(min_length=6)
    company: Optional[CompanyIn] = None  # eksportyor uchun majburiy

    @model_validator(mode="after")
    def _require_company_for_exporter(self):
        if self.role == "exporter" and self.company is None:
            raise ValueError("Eksportyor uchun korxona ma'lumoti (company) majburiy")
        if self.role == "importer" and self.company is not None:
            # importer uchun korxona kerak emas — e'tiborsiz qoldiramiz
            self.company = None
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: UUID
    role: str
    name: str
    email: Optional[str] = None
    company_id: Optional[UUID] = None


class TokenResponse(BaseModel):
    ok: bool = True
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# =====================================================================
#  Entity sxemalari (5-qadam) — Lot, RFQ
# =====================================================================
INCOTERMS = Literal["exw", "fca", "fob", "cfr", "cif", "cpt", "cip", "dap", "ddp"]
LOT_STATUSES = Literal["complete", "pooling", "matched", "shipped", "closed"]


class LotCreate(BaseModel):
    product_id: UUID
    quantity_t: float = Field(gt=0)
    price_per_ton: Optional[float] = Field(default=None, ge=0)
    grade: Optional[int] = Field(default=None, ge=1, le=3)
    warehouse_id: Optional[UUID] = None
    spec: dict = Field(default_factory=dict)
    origin: Optional[str] = None


class LotUpdate(BaseModel):
    quantity_t: Optional[float] = Field(default=None, gt=0)
    price_per_ton: Optional[float] = Field(default=None, ge=0)
    grade: Optional[int] = Field(default=None, ge=1, le=3)
    warehouse_id: Optional[UUID] = None
    spec: Optional[dict] = None
    origin: Optional[str] = None
    status: Optional[LOT_STATUSES] = None


class QualityUpdate(BaseModel):
    status: Literal["passed", "rejected"]
    lab_result: Optional[dict] = None
    note: Optional[str] = None


class RfqCreate(BaseModel):
    product_id: UUID
    target_quantity_t: float = Field(gt=0)
    market_id: Optional[UUID] = None
    incoterm: Optional[INCOTERMS] = None
    grade: Optional[int] = Field(default=None, ge=1, le=3)
    maq_t: Optional[float] = Field(default=None, ge=0)
    tolerance_pct: Optional[float] = Field(default=None, ge=0)
    deadline: Optional[date] = None
    price_ceiling_usd: Optional[float] = Field(default=None, ge=0)
    spec: dict = Field(default_factory=dict)


class RfqUpdate(BaseModel):
    target_quantity_t: Optional[float] = Field(default=None, gt=0)
    market_id: Optional[UUID] = None
    incoterm: Optional[INCOTERMS] = None
    grade: Optional[int] = Field(default=None, ge=1, le=3)
    maq_t: Optional[float] = Field(default=None, ge=0)
    tolerance_pct: Optional[float] = Field(default=None, ge=0)
    deadline: Optional[date] = None
    price_ceiling_usd: Optional[float] = Field(default=None, ge=0)
    status: Optional[Literal["open", "closed", "cancelled"]] = None


# =====================================================================
#  Pool sxemalari (6-qadam) — yig'ish
# =====================================================================
class PoolCreate(BaseModel):
    product_id: UUID
    target_qty_t: float = Field(gt=0)
    rfq_id: Optional[UUID] = None
    grade: Optional[int] = Field(default=None, ge=1, le=3)
    deadline: Optional[date] = None
    forward: bool = False
    newcomer_quota_pct: Optional[float] = Field(default=None, ge=0, le=100)
    score_weights: Optional[dict] = None
    spec: dict = Field(default_factory=dict)


class PoolEntryCreate(BaseModel):
    lot_id: UUID
    quantity_t: float = Field(gt=0)


# =====================================================================
#  Buyurtma/jo'natma sxemalari (7-qadam)
# =====================================================================
TRANSPORT_MODES = Literal["rail", "sea", "road", "air", "multimodal"]
CONTAINER_TYPES = Literal["c20", "c40", "c40hc", "reefer"]


class OrderCreate(BaseModel):
    pool_id: UUID
    incoterm: Optional[INCOTERMS] = None
    transport_mode: Optional[TRANSPORT_MODES] = None
    container_type: Optional[CONTAINER_TYPES] = None
    advance_pct: Optional[float] = Field(default=None, ge=0, le=100)
    commission_pct: Optional[float] = Field(default=None, ge=0, le=100)


class ShipCreate(BaseModel):
    provider_id: Optional[UUID] = None
    corridor_id: Optional[UUID] = None
    warehouse_id: Optional[UUID] = None
    departure_date: Optional[date] = None
    container_type: Optional[CONTAINER_TYPES] = None
    transport_mode: Optional[TRANSPORT_MODES] = None


# =====================================================================
#  AI maslahatchi sxemasi (8-qadam)
# =====================================================================
class AdvisorRequest(BaseModel):
    question: str = Field(min_length=3)
    preview: bool = False  # true bo'lsa LLM chaqirilmaydi — yig'ilgan kontekst qaytadi


class DocAnalyzeRequest(BaseModel):
    text: str = Field(min_length=20)  # hujjat matni
    kind: Optional[str] = None        # ixtiyoriy: hujjat turi (shartnoma, invoys, ...)


# =====================================================================
#  Xodim (staff) va elchixona lead sxemalari
# =====================================================================
class AiSettingsUpdate(BaseModel):
    provider: Literal["anthropic", "openai", "google", "custom"] = "anthropic"
    api_key: str = Field(min_length=8, max_length=400)
    base_url: Optional[str] = None      # faqat 'custom' uchun
    model: Optional[str] = None         # bo'sh -> provayder standarti


class StaffCreate(BaseModel):
    role: Literal["embassy", "logistics", "warehouse"]
    name: str = Field(min_length=2)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(min_length=6)


class LeadCreate(BaseModel):
    importer_contact: str = Field(min_length=2)   # tashqi xaridor kontakti
    market_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    importer_contact: Optional[str] = Field(default=None, min_length=2)
    market_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    notes: Optional[str] = None
