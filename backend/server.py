from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query, File, UploadFile, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import uuid
import secrets
import time
import hashlib
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta
import math
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict
from contextlib import asynccontextmanager
from receipt_processor import ReceiptParser, OCREngine, OCRError
from ocr_service import (
    build_missing_ocr_error,
    decode_base64_image_data,
    get_ocr_runtime_status,
    validate_receipt_upload,
)
from item_assignment import (
    calculateBillTotals,
    normalize_item_payload as normalize_item_payload_service,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def initialize_database_indexes() -> None:
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.bills.create_index("bill_id", unique=True)
    await db.bills.create_index("owner_id")
    await db.bills.create_index("status")
    await db.bills.create_index([("owner_id", 1), ("status", 1)])
    await db.bills.create_index([("owner_id", 1), ("created_at", -1)])
    await db.share_links.create_index("token", unique=True)
    await db.share_links.create_index("bill_id")
    await db.exchange_rates.create_index([("base_currency", 1), ("target_currency", 1)])
    await db.subscriptions.create_index("user_id")
    await db.audit_logs.create_index([("user_id", 1), ("timestamp", -1)])
    await db.idempotency_keys.create_index("key", unique=True)
    await db.idempotency_keys.create_index("created_at", expireAfterSeconds=86400)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await initialize_database_indexes()
    ocr_status = get_ocr_runtime_status()
    _app.state.ocr_dependency = ocr_status
    if ocr_status.get("available"):
        logger.info(f"OCR dependency ready: provider={ocr_status.get('provider')}")
    else:
        logger.warning("OCR dependency missing: no OCR provider is available")
    logger.info("SplitBill Pro API v2.0.0 started - all indexes created")
    try:
        yield
    finally:
        client.close()


app = FastAPI(title="SplitBill Pro API", version="2.0.0", lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# ─── STRUCTURED LOGGING ───────────────────────────────────────────

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "correlation_id": getattr(record, "correlation_id", None),
        }
        if record.exc_info and record.exc_info[0]:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger = logging.getLogger("splitbill")
logger.handlers = [handler]
logger.setLevel(logging.INFO)

# ─── RATE LIMITING (In-Memory) ─────────────────────────────────────

class RateLimiter:
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.is_dev = os.environ.get('ENV', 'development').lower() in ('dev', 'development', 'local')
        
        if self.is_dev:
            # Very lenient limits for development
            self.limits = {
                "default": (1000, 60),      # 1000 requests per 60 seconds
                "auth": (1000, 60),         # 1000 auth attempts per 60 seconds
                "create": (1000, 60),       # 1000 creates per 60 seconds
            }
        else:
            # Strict limits for production
            self.limits = {
                "default": (60, 60),        # 60 requests per 60 seconds
                "auth": (10, 60),           # 10 auth attempts per 60 seconds
                "create": (20, 60),         # 20 creates per 60 seconds
            }

    def is_allowed(self, key: str, category: str = "default") -> bool:
        max_requests, window = self.limits.get(category, self.limits["default"])
        now = time.time()
        self.requests[key] = [t for t in self.requests[key] if now - t < window]
        if len(self.requests[key]) >= max_requests:
            return False
        self.requests[key].append(now)
        return True

rate_limiter = RateLimiter()

# ─── MIDDLEWARE ────────────────────────────────────────────────────

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        category = "default"
        if "/auth/" in path:
            category = "auth"
        elif request.method == "POST" and "/bills" in path:
            category = "create"
        if not rate_limiter.is_allowed(f"{client_ip}:{category}", category):
            return Response(
                content=json.dumps({"detail": "Rate limit exceeded. Try again later."}),
                status_code=429,
                media_type="application/json",
            )
        return await call_next(request)

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start) * 1000, 2)
        cid = getattr(request.state, "correlation_id", "N/A")
        logger.info(
            f"{request.method} {request.url.path} → {response.status_code} ({duration_ms}ms)",
            extra={"correlation_id": cid},
        )
        return response

# ─── PYDANTIC MODELS (HARDENED) ────────────────────────────────────

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    plan: str = "free"
    preferred_currency: str = "USD"
    created_at: Optional[str] = None

class UserPreferencesUpdate(BaseModel):
    preferred_currency: str = Field(min_length=3, max_length=3)
    
    @field_validator("preferred_currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        return v.upper()

class SessionExchange(BaseModel):
    session_id: str
    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        if not v or len(v) < 5:
            raise ValueError("Invalid session_id")
        return v.strip()


class ItemAssignment(BaseModel):
    userId: str
    quantity: int = Field(ge=0, le=1000)

class BillItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0, le=1000000)
    quantity: int = Field(ge=1, le=1000, default=1)
    assigned_to: List[str] = Field(default_factory=list)
    assigned_quantities: Dict[str, int] = Field(default_factory=dict)
    assignments: List[ItemAssignment] = Field(default_factory=list)
    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return v.strip()

class BillItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    price: Optional[float] = Field(None, gt=0, le=1000000)
    quantity: Optional[int] = Field(None, ge=1, le=1000)
    assigned_to: Optional[List[str]] = None
    assigned_quantities: Optional[Dict[str, int]] = None
    assignments: Optional[List[ItemAssignment]] = None

class ParticipantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    contact_info: Optional[str] = ""
    client_id: Optional[str] = None
    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return v.strip()

class BillCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    converted_currency: Optional[str] = None
    items: List[BillItemCreate] = []
    participants: List[ParticipantCreate] = []
    tax_type: str = "percentage"
    tax_value: float = Field(default=0, ge=0, le=100000)
    service_charge: float = Field(default=0, ge=0, le=100000)
    additional_fees: List[Dict[str, Any]] = []
    split_method: str = "equal"
    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        return v.strip()
    @field_validator("split_method")
    @classmethod
    def validate_split(cls, v: str) -> str:
        if v not in ("equal", "per_item", "percentage", "custom"):
            raise ValueError("Invalid split method")
        return v
    @field_validator("tax_type")
    @classmethod
    def validate_tax_type(cls, v: str) -> str:
        if v not in ("percentage", "fixed"):
            raise ValueError("Invalid tax type")
        return v

class BillUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    currency: Optional[str] = None
    converted_currency: Optional[str] = None
    tax_type: Optional[str] = None
    tax_value: Optional[float] = Field(None, ge=0)
    service_charge: Optional[float] = Field(None, ge=0)
    additional_fees: Optional[List[Dict[str, Any]]] = None
    split_method: Optional[str] = None

class PaymentUpdate(BaseModel):
    amount_paid: float = Field(ge=0)
    status: str = "paid"
    idempotency_key: Optional[str] = None
    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("unpaid", "partial", "paid"):
            raise ValueError("Invalid payment status")
        return v

class SplitRequest(BaseModel):
    method: str = "equal"
    custom_splits: Optional[Dict[str, float]] = None
    percentages: Optional[Dict[str, float]] = None

class ShareLinkCreate(BaseModel):
    expires_hours: int = Field(default=72, ge=1, le=720)
    public_access: bool = True

class SubscriptionUpdate(BaseModel):
    plan: str
    @field_validator("plan")
    @classmethod
    def validate_plan(cls, v: str) -> str:
        if v not in ("free", "pro"):
            raise ValueError("Invalid plan. Must be 'free' or 'pro'")
        return v

class ReceiptItem(BaseModel):
    name: str
    quantity: int = 1
    price: float

class ReceiptScanResult(BaseModel):
    currency: str
    items: List[ReceiptItem]
    subtotal: float
    tax: float
    service_charge: float
    total: float
    confidence: float  # 0-1 confidence score

# ─── PLAN LIMITS ───────────────────────────────────────────────────

PLAN_LIMITS = {
    "free": {"max_active_bills": 5, "ocr": False, "export": False, "analytics": False},
    "pro": {"max_active_bills": 999999, "ocr": True, "export": True, "analytics": True},
}

# ─── AUTH & FEATURE GATE HELPERS ───────────────────────────────────

async def get_current_user(request: Request) -> dict:
    token = None
    cookie_token = request.cookies.get("session_token")
    if cookie_token:
        token = cookie_token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    # Refresh token if expiring within 24 hours
    if expires_at - datetime.now(timezone.utc) < timedelta(hours=24):
        new_expiry = datetime.now(timezone.utc) + timedelta(days=7)
        await db.user_sessions.update_one(
            {"session_token": token},
            {"$set": {"expires_at": new_expiry}}
        )
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def require_pro(user: dict = Depends(get_current_user)) -> dict:
    if user.get("plan", "free") != "pro":
        raise HTTPException(status_code=403, detail="Pro plan required. Upgrade to access this feature.")
    return user

async def check_bill_limit(user: dict) -> None:
    # Local/dev environments should not be blocked by monetization limits during QA.
    env = os.environ.get("ENV", "development").lower()
    if env in ("dev", "development", "local"):
        return

    plan = user.get("plan", "free")
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    active_count = await db.bills.count_documents({"owner_id": user["user_id"], "status": "active"})
    if active_count >= limits["max_active_bills"]:
        raise HTTPException(status_code=403, detail=f"Active bill limit reached ({limits['max_active_bills']}). Upgrade to Pro for unlimited bills.")


def _is_bill_participant(bill: dict, user: dict) -> bool:
    user_email = str(user.get("email", "")).strip().lower()
    if not user_email:
        return False
    for participant in bill.get("participants", []):
        contact = str(participant.get("contact_info", "")).strip().lower()
        if contact and contact == user_email:
            return True
    return False


def ensure_bill_access(bill: dict, user: dict, owner_only: bool = False) -> None:
    if bill.get("owner_id") == user.get("user_id"):
        return
    if owner_only:
        raise HTTPException(status_code=403, detail="Not authorized")
    if _is_bill_participant(bill, user):
        return
    raise HTTPException(status_code=403, detail="Not authorized")

async def log_audit(user_id: str, action: str, entity: str, entity_id: str, details: str = ""):
    await db.audit_logs.insert_one({
        "log_id": f"log_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

async def convert_currency(amount: float, from_currency: str, to_currency: str) -> float:
    """Convert amount from one currency to another using cached exchange rates"""
    if from_currency == to_currency:
        return amount
    
    rate_doc = await db.exchange_rates.find_one({
        "base_currency": from_currency.upper(),
        "target_currency": to_currency.upper()
    }, {"_id": 0})
    
    if rate_doc:
        rate = rate_doc.get("rate", 1.0)
    else:
        # Try to fetch from API if not cached
        try:
            async with httpx.AsyncClient() as hc:
                resp = await hc.get(
                    f"https://api.frankfurter.dev/v1/latest?from={from_currency.upper()}&to={to_currency.upper()}",
                    timeout=5
                )
            if resp.status_code == 200:
                data = resp.json()
                rate = data.get("rates", {}).get(to_currency.upper(), 1.0)
                # Cache the result
                await db.exchange_rates.update_one(
                    {"base_currency": from_currency.upper(), "target_currency": to_currency.upper()},
                    {"$set": {
                        "base_currency": from_currency.upper(),
                        "target_currency": to_currency.upper(),
                        "rate": rate,
                        "fetched_at": datetime.now(timezone.utc).isoformat()
                    }},
                    upsert=True
                )
            else:
                rate = 1.0
        except Exception as e:
            logger.error(f"Currency conversion error: {e}")
            rate = 1.0
    
    return round(amount * rate, 2)

# ─── SPLIT CALCULATION ENGINE ─────────────────────────────────────

def calculate_splits(bill: dict, method: str = "equal", custom_splits: dict = None, percentages: dict = None) -> list:
    participants = bill.get("participants", [])
    if not participants:
        return []
    total = Decimal(str(bill.get("total_amount", 0)))
    items = bill.get("items", [])
    splits = []

    if method == "equal":
        n = len(participants)
        base = (total / n).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        remainder = total - (base * n)
        remainder_cents = int(remainder / Decimal("0.01"))
        for i, p in enumerate(participants):
            amount = base + (Decimal("0.01") if i < abs(remainder_cents) else Decimal("0"))
            existing = next((s for s in bill.get("splits", []) if s["participant_id"] == p["participant_id"]), None)
            splits.append({
                "participant_id": p["participant_id"],
                "participant_name": p["name"],
                "amount_due": float(amount),
                "amount_paid": existing["amount_paid"] if existing else 0,
                "status": existing["status"] if existing else "unpaid"
            })

    elif method == "per_item":
        participant_totals = calculateBillTotals(items, participants)
        subtotal = sum(participant_totals.values())
        if subtotal > 0:
            extras = total - Decimal(str(bill.get("subtotal", 0)))
            for pid in participant_totals:
                ratio = participant_totals[pid] / subtotal
                participant_totals[pid] += (extras * ratio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        for p in participants:
            existing = next((s for s in bill.get("splits", []) if s["participant_id"] == p["participant_id"]), None)
            splits.append({
                "participant_id": p["participant_id"],
                "participant_name": p["name"],
                "amount_due": float(participant_totals.get(p["participant_id"], Decimal("0"))),
                "amount_paid": existing["amount_paid"] if existing else 0,
                "status": existing["status"] if existing else "unpaid"
            })

    elif method == "percentage" and percentages:
        for p in participants:
            pct = Decimal(str(percentages.get(p["participant_id"], 0)))
            amount = (total * pct / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            existing = next((s for s in bill.get("splits", []) if s["participant_id"] == p["participant_id"]), None)
            splits.append({
                "participant_id": p["participant_id"],
                "participant_name": p["name"],
                "amount_due": float(amount),
                "amount_paid": existing["amount_paid"] if existing else 0,
                "status": existing["status"] if existing else "unpaid"
            })

    elif method == "custom" and custom_splits:
        for p in participants:
            amount = float(custom_splits.get(p["participant_id"], 0))
            existing = next((s for s in bill.get("splits", []) if s["participant_id"] == p["participant_id"]), None)
            splits.append({
                "participant_id": p["participant_id"],
                "participant_name": p["name"],
                "amount_due": max(amount, 0),
                "amount_paid": existing["amount_paid"] if existing else 0,
                "status": existing["status"] if existing else "unpaid"
            })
    else:
        return calculate_splits(bill, "equal")
    return splits

def normalize_item_payload(item: dict, valid_participant_ids: set) -> dict:
    return normalize_item_payload_service(item, valid_participant_ids)


def normalize_item_payload_or_http(item: dict, valid_participant_ids: set) -> dict:
    try:
        return normalize_item_payload(item, valid_participant_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def calculate_splits_or_http_error(bill: dict, method: str = "equal", custom_splits: dict = None, percentages: dict = None) -> list:
    try:
        return calculate_splits(bill, method, custom_splits, percentages)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

def compute_bill_totals(bill: dict) -> dict:
    items = bill.get("items", [])
    subtotal = sum(Decimal(str(i["price"])) * Decimal(str(i["quantity"])) for i in items)
    tax_type = bill.get("tax_type", "percentage")
    tax_value = Decimal(str(bill.get("tax_value", 0)))
    if tax_type == "percentage":
        tax_amount = (subtotal * tax_value / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        tax_amount = tax_value
    service_charge = Decimal(str(bill.get("service_charge", 0)))
    additional = sum(Decimal(str(f.get("amount", 0))) for f in bill.get("additional_fees", []))
    total = subtotal + tax_amount + service_charge + additional
    total = max(total, Decimal("0"))  # Prevent negative totals
    return {
        "subtotal": float(subtotal.quantize(Decimal("0.01"))),
        "tax_amount": float(tax_amount.quantize(Decimal("0.01"))),
        "total_amount": float(total.quantize(Decimal("0.01")))
    }


def normalize_crop_points(points: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """Normalize arbitrary quadrilateral points to TL, TR, BR, BL order."""
    if len(points) != 4:
        raise ValueError("Crop polygon must contain exactly 4 points")

    by_sum = sorted(points, key=lambda p: p[0] + p[1])
    tl = by_sum[0]
    br = by_sum[-1]
    rem = [p for p in points if p not in (tl, br)]
    rem_sorted = sorted(rem, key=lambda p: p[0] - p[1])
    bl = rem_sorted[0]
    tr = rem_sorted[-1]
    return [tl, tr, br, bl]


def calculate_polygon_area(points: List[Tuple[float, float]]) -> float:
    if len(points) < 3:
        return 0.0
    acc = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        acc += x1 * y2 - x2 * y1
    return abs(acc) * 0.5


def is_self_intersecting_quadrilateral(points: List[Tuple[float, float]]) -> bool:
    if len(points) != 4:
        return True

    def orient(p: Tuple[float, float], q: Tuple[float, float], r: Tuple[float, float]) -> float:
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    def segments_intersect(a1: Tuple[float, float], a2: Tuple[float, float], b1: Tuple[float, float], b2: Tuple[float, float]) -> bool:
        o1 = orient(a1, a2, b1)
        o2 = orient(a1, a2, b2)
        o3 = orient(b1, b2, a1)
        o4 = orient(b1, b2, a2)
        return (o1 * o2 < 0) and (o3 * o4 < 0)

    # For ordered TL, TR, BR, BL, these are the non-adjacent edges.
    return segments_intersect(points[0], points[1], points[2], points[3]) or segments_intersect(points[1], points[2], points[3], points[0])


def validate_crop_quadrilateral(points: List[Tuple[float, float]], min_area: float = 25.0) -> None:
    if len(points) != 4:
        raise ValueError("Crop polygon must contain exactly 4 points")
    if calculate_polygon_area(points) < min_area:
        raise ValueError("Crop polygon area is too small")
    if is_self_intersecting_quadrilateral(points):
        raise ValueError("Crop polygon is invalid or self-intersecting")


def default_crop_points(width: int, height: int) -> List[Tuple[float, float]]:
    inset_x = max(12.0, width * 0.08)
    inset_y = max(12.0, height * 0.08)
    return [
        (inset_x, inset_y),
        (width - inset_x, inset_y),
        (width - inset_x, height - inset_y),
        (inset_x, height - inset_y),
    ]


def suggest_receipt_crop_points(image_bytes: bytes) -> Tuple[List[Tuple[float, float]], str]:
    """Detect a stable initial crop quadrilateral. Returns points in TL, TR, BR, BL order."""
    from io import BytesIO
    from PIL import Image, ImageOps

    try:
        import numpy as np
    except Exception:
        img = Image.open(BytesIO(image_bytes))
        return default_crop_points(img.width, img.height), "fallback-no-numpy"

    with Image.open(BytesIO(image_bytes)) as src:
        src.load()
        img = src.convert("RGB")

    orig_w, orig_h = img.size
    if orig_w <= 0 or orig_h <= 0:
        return default_crop_points(max(orig_w, 1), max(orig_h, 1)), "fallback-invalid-size"

    max_side = max(orig_w, orig_h)
    scale = 1.0
    if max_side > 1200:
        scale = 1200.0 / float(max_side)
        resized = img.resize((max(1, int(round(orig_w * scale))), max(1, int(round(orig_h * scale)))), Image.Resampling.BILINEAR)
    else:
        resized = img

    gray = ImageOps.autocontrast(resized.convert("L"))
    arr = np.asarray(gray, dtype=np.float32)
    h, w = arr.shape

    if h < 20 or w < 20:
        points = default_crop_points(w, h)
    else:
        p5, p95 = np.percentile(arr, [5, 95])
        spread = max(1.0, float(p95 - p5))
        norm = np.clip((arr - p5) / spread, 0.0, 1.0)

        gx = np.abs(np.diff(norm, axis=1, prepend=norm[:, :1]))
        gy = np.abs(np.diff(norm, axis=0, prepend=norm[:1, :]))
        edge = 0.5 * (gx + gy)

        threshold = float(np.percentile(edge, 88))
        mask = edge >= threshold

        border = max(4, int(min(h, w) * 0.02))
        mask[:border, :] = False
        mask[h - border :, :] = False
        mask[:, :border] = False
        mask[:, w - border :] = False

        ys, xs = np.where(mask)
        if len(xs) < 120:
            points = default_crop_points(w, h)
        else:
            left = float(np.percentile(xs, 4))
            right = float(np.percentile(xs, 96))
            top = float(np.percentile(ys, 4))
            bottom = float(np.percentile(ys, 96))

            pad_x = max(4.0, (right - left) * 0.03)
            pad_y = max(4.0, (bottom - top) * 0.03)
            min_margin_x = max(6.0, w * 0.015)
            min_margin_y = max(6.0, h * 0.015)

            left = max(min_margin_x, left - pad_x)
            right = min(w - min_margin_x, right + pad_x)
            top = max(min_margin_y, top - pad_y)
            bottom = min(h - min_margin_y, bottom + pad_y)

            min_width = w * 0.35
            min_height = h * 0.35
            if (right - left) < min_width:
                cx = (left + right) * 0.5
                half = min_width * 0.5
                left = max(min_margin_x, cx - half)
                right = min(w - min_margin_x, cx + half)
            if (bottom - top) < min_height:
                cy = (top + bottom) * 0.5
                half = min_height * 0.5
                top = max(min_margin_y, cy - half)
                bottom = min(h - min_margin_y, cy + half)

            points = [(left, top), (right, top), (right, bottom), (left, bottom)]

    if scale != 1.0:
        points = [(x / scale, y / scale) for x, y in points]

    clamped = [
        (
            max(0.0, min(float(orig_w - 1), float(x))),
            max(0.0, min(float(orig_h - 1), float(y))),
        )
        for x, y in points
    ]

    try:
        normalized = normalize_crop_points(clamped)
        validate_crop_quadrilateral(normalized, min_area=100.0)
        return normalized, "auto-edge"
    except ValueError:
        fallback = default_crop_points(orig_w, orig_h)
        return normalize_crop_points(fallback), "fallback-geometry"

# ─── AUTH ENDPOINTS ────────────────────────────────────────────────

@api_router.post("/auth/session")
async def exchange_session(data: SessionExchange, response: Response):
    session_hash = hashlib.sha256(data.session_id.encode("utf-8")).hexdigest()
    identity = session_hash[:12]
    email = f"user_{identity}@splitbill.local"
    name = f"User {identity[:6]}"
    picture = ""

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture, "updated_at": datetime.now(timezone.utc).isoformat()}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "plan": "free",
            "preferred_currency": "USD",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    session_token = f"st_{secrets.token_hex(32)}"
    await db.user_sessions.insert_one({
        "session_token": session_token, "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7 * 24 * 3600)
    await log_audit(user_id, "login", "user", user_id)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": {k: user_doc.get(k) for k in ["user_id", "email", "name", "picture", "plan", "preferred_currency"]}}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return UserOut(**{k: user.get(k) for k in ["user_id", "email", "name", "picture", "plan", "preferred_currency", "created_at"] if k in user or k == "preferred_currency"})

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

# ─── USER PREFERENCES ──────────────────────────────────────────────

@api_router.get("/user/preferences")
async def get_user_preferences(user: dict = Depends(get_current_user)):
    """Get user preferences including preferred currency"""
    return {
        "user_id": user["user_id"],
        "preferred_currency": user.get("preferred_currency", "USD"),
    }

@api_router.put("/user/preferences")
async def update_user_preferences(data: UserPreferencesUpdate, user: dict = Depends(get_current_user)):
    """Update user preferences including preferred currency"""
    update_data = {
        "preferred_currency": data.preferred_currency,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})
    await log_audit(user["user_id"], "update_preferences", "user", user["user_id"], f"preferred_currency={data.preferred_currency}")
    return {
        "user_id": user["user_id"],
        "preferred_currency": data.preferred_currency,
    }

# ─── SUBSCRIPTION ENDPOINTS ───────────────────────────────────────

@api_router.get("/subscription")
async def get_subscription(user: dict = Depends(get_current_user)):
    plan = user.get("plan", "free")
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    active_count = await db.bills.count_documents({"owner_id": user["user_id"], "status": "active"})
    sub = await db.subscriptions.find_one({"user_id": user["user_id"], "status": "active"}, {"_id": 0})
    return {
        "plan": plan,
        "limits": limits,
        "active_bills": active_count,
        "subscription": sub,
        "pricing": {"pro": {"amount": 4.99, "currency": "USD", "interval": "month"}}
    }

@api_router.post("/subscription/upgrade")
async def upgrade_subscription(data: SubscriptionUpdate, user: dict = Depends(get_current_user)):
    if data.plan == "pro":
        sub_id = f"sub_{uuid.uuid4().hex[:12]}"
        subscription = {
            "subscription_id": sub_id,
            "user_id": user["user_id"],
            "plan": "pro",
            "status": "active",
            "amount": 4.99,
            "currency": "USD",
            "interval": "month",
            "payment_method": "pending_integration",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.subscriptions.update_one(
            {"user_id": user["user_id"]}, {"$set": subscription}, upsert=True
        )
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"plan": "pro", "updated_at": datetime.now(timezone.utc).isoformat()}})
        await log_audit(user["user_id"], "upgrade_plan", "subscription", sub_id, "pro")
        return {"message": "Upgraded to Pro", "plan": "pro", "subscription_id": sub_id}
    else:
        await db.subscriptions.update_one(
            {"user_id": user["user_id"]}, {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"plan": "free", "updated_at": datetime.now(timezone.utc).isoformat()}})
        await log_audit(user["user_id"], "downgrade_plan", "subscription", user["user_id"], "free")
        return {"message": "Downgraded to Free", "plan": "free"}

@api_router.get("/subscription/features")
async def get_features():
    return {
        "plans": {
            "free": {
                "name": "Free", "price": 0, "features": [
                    "Up to 5 active bills", "Equal & per-item splitting",
                    "Multi-currency support", "Bill sharing via links",
                    "Payment tracking"
                ],
                "limits": PLAN_LIMITS["free"]
            },
            "pro": {
                "name": "Pro", "price": 4.99, "interval": "month", "features": [
                    "Unlimited active bills", "All split methods",
                    "OCR receipt scanning", "PDF & Excel export",
                    "Analytics dashboard", "Priority support",
                    "Group spending insights"
                ],
                "limits": PLAN_LIMITS["pro"]
            }
        }
    }

# ─── BILLS ENDPOINTS (with pagination) ────────────────────────────

@api_router.post("/bills")
async def create_bill(data: BillCreate, user: dict = Depends(get_current_user)):
    await check_bill_limit(user)
    bill_id = f"bill_{uuid.uuid4().hex[:12]}"
    participants: List[Dict[str, Any]] = []
    participant_id_map: Dict[str, str] = {}
    participant_name_map: Dict[str, str] = {}
    seen_client_ids: set[str] = set()
    seen_fallback_keys: set[str] = set()

    for p in data.participants:
        client_id = (p.client_id or "").strip()
        normalized_name = p.name.strip()
        normalized_contact = (p.contact_info or "").strip()
        fallback_key = f"{normalized_name.lower()}::{normalized_contact.lower()}"

        if client_id:
            if client_id in seen_client_ids:
                continue
            seen_client_ids.add(client_id)
        else:
            if fallback_key in seen_fallback_keys:
                continue
            seen_fallback_keys.add(fallback_key)

        participant_id = f"part_{uuid.uuid4().hex[:12]}"
        participants.append({
            "participant_id": participant_id,
            "name": normalized_name,
            "contact_info": normalized_contact,
            "is_owner": False,
        })
        if client_id:
            participant_id_map[client_id] = participant_id
        participant_name_map.setdefault(normalized_name.lower(), participant_id)

    if not participants:
        raise HTTPException(status_code=400, detail="At least one participant is required")

    items = []
    valid_participant_ids = {p["participant_id"] for p in participants}
    for item in data.items:
        resolved_assigned_to: List[str] = []
        for token in item.assigned_to:
            mapped_id = participant_id_map.get(token)
            if mapped_id:
                resolved_assigned_to.append(mapped_id)
                continue

            mapped_by_name = participant_name_map.get(str(token).strip().lower())
            if mapped_by_name:
                resolved_assigned_to.append(mapped_by_name)

        # Keep unique order to avoid duplicate participant assignment.
        resolved_assigned_to = list(dict.fromkeys(resolved_assigned_to))

        resolved_assigned_quantities: Dict[str, int] = {}
        for token, qty in item.assigned_quantities.items():
            mapped_id = participant_id_map.get(token)
            if mapped_id is None:
                mapped_id = participant_name_map.get(str(token).strip().lower())
            if mapped_id is None:
                continue
            try:
                parsed_qty = int(qty)
            except (TypeError, ValueError):
                continue
            if parsed_qty > 0:
                resolved_assigned_quantities[mapped_id] = parsed_qty

        if not resolved_assigned_quantities and item.assignments:
            for entry in item.assignments:
                token = entry.userId
                mapped_id = participant_id_map.get(token)
                if mapped_id is None:
                    mapped_id = participant_name_map.get(str(token).strip().lower())
                if mapped_id is None:
                    continue
                if entry.quantity > 0:
                    resolved_assigned_quantities[mapped_id] = int(entry.quantity)

        normalized_item = normalize_item_payload_or_http({
            "item_id": f"item_{uuid.uuid4().hex[:12]}",
            "name": item.name,
            "price": item.price,
            "quantity": item.quantity,
            "assigned_to": resolved_assigned_to,
            "assigned_quantities": resolved_assigned_quantities,
        }, valid_participant_ids)
        items.append(normalized_item)
    bill = {
        "bill_id": bill_id, "owner_id": user["user_id"], "title": data.title, "currency": data.currency.upper(),
        "converted_currency": data.converted_currency, "exchange_rate": None, "exchange_rate_locked": False,
        "items": items, "participants": participants,
        "tax_type": data.tax_type, "tax_value": data.tax_value, "service_charge": data.service_charge,
        "additional_fees": [dict(f) for f in data.additional_fees],
        "split_method": data.split_method, "splits": [], "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()
    }
    totals = compute_bill_totals(bill)
    bill.update(totals)
    bill["splits"] = calculate_splits_or_http_error(bill, data.split_method)
    await db.bills.insert_one(bill)
    await log_audit(user["user_id"], "create_bill", "bill", bill_id)
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

@api_router.get("/bills")
async def get_bills(
    user: dict = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    query: Dict[str, Any] = {"$or": [
        {"owner_id": user["user_id"]},
        {"participants.contact_info": user.get("email", "")}
    ]}
    if status and status in ("active", "settled", "archived"):
        query["status"] = status
    if search:
        query["title"] = {"$regex": search, "$options": "i"}
    total_count = await db.bills.count_documents(query)
    bills = await db.bills.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"bills": bills, "total": total_count, "skip": skip, "limit": limit}

@api_router.get("/bills/{bill_id}")
async def get_bill(bill_id: str, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user)
    return bill

@api_router.put("/bills/{bill_id}")
async def update_bill(bill_id: str, data: BillUpdate, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user, owner_only=True)
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    bill.update(updates)
    totals = compute_bill_totals(bill)
    updates.update(totals)
    bill.update(totals)
    updates["splits"] = calculate_splits_or_http_error(bill, bill.get("split_method", "equal"))
    await db.bills.update_one({"bill_id": bill_id}, {"$set": updates})
    await log_audit(user["user_id"], "update_bill", "bill", bill_id)
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

@api_router.delete("/bills/{bill_id}")
async def delete_bill(bill_id: str, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user, owner_only=True)
    await db.bills.delete_one({"bill_id": bill_id})
    await db.share_links.delete_many({"bill_id": bill_id})
    await log_audit(user["user_id"], "delete_bill", "bill", bill_id)
    return {"message": "Bill deleted"}

# ─── BILL ITEMS ────────────────────────────────────────────────────

@api_router.post("/bills/{bill_id}/items")
async def add_item(bill_id: str, data: BillItemCreate, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user, owner_only=True)
    valid_participant_ids = {p["participant_id"] for p in bill.get("participants", [])}
    item = normalize_item_payload_or_http({
        "item_id": f"item_{uuid.uuid4().hex[:12]}",
        "name": data.name,
        "price": data.price,
        "quantity": data.quantity,
        "assigned_to": data.assigned_to,
        "assigned_quantities": data.assigned_quantities,
        "assignments": [entry.model_dump() for entry in data.assignments],
    }, valid_participant_ids)
    bill["items"].append(item)
    totals = compute_bill_totals(bill)
    bill.update(totals)
    splits = calculate_splits_or_http_error(bill, bill.get("split_method", "equal"))
    await db.bills.update_one({"bill_id": bill_id}, {"$push": {"items": item}, "$set": {**totals, "splits": splits, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await log_audit(user["user_id"], "add_item", "bill", bill_id, item["name"])
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

@api_router.put("/bills/{bill_id}/items/{item_id}")
async def update_item(bill_id: str, item_id: str, data: BillItemUpdate, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user, owner_only=True)
    items = bill.get("items", [])
    for i, item in enumerate(items):
        if item["item_id"] == item_id:
            for k, v in data.model_dump(exclude_unset=True).items():
                if v is not None:
                    items[i][k] = v
            valid_participant_ids = {p["participant_id"] for p in bill.get("participants", [])}
            items[i] = normalize_item_payload_or_http(items[i], valid_participant_ids)
            break
    bill["items"] = items
    totals = compute_bill_totals(bill)
    bill.update(totals)
    splits = calculate_splits_or_http_error(bill, bill.get("split_method", "equal"))
    await db.bills.update_one({"bill_id": bill_id}, {"$set": {"items": items, **totals, "splits": splits, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

@api_router.delete("/bills/{bill_id}/items/{item_id}")
async def delete_item(bill_id: str, item_id: str, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user, owner_only=True)
    items = [i for i in bill.get("items", []) if i["item_id"] != item_id]
    bill["items"] = items
    totals = compute_bill_totals(bill)
    bill.update(totals)
    splits = calculate_splits_or_http_error(bill, bill.get("split_method", "equal"))
    await db.bills.update_one({"bill_id": bill_id}, {"$set": {"items": items, **totals, "splits": splits, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

# ─── PARTICIPANTS ──────────────────────────────────────────────────

@api_router.post("/bills/{bill_id}/participants")
async def add_participant(bill_id: str, data: ParticipantCreate, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user, owner_only=True)
    participant = {"participant_id": f"part_{uuid.uuid4().hex[:12]}", "name": data.name, "contact_info": data.contact_info or "", "is_owner": False}
    bill["participants"].append(participant)
    splits = calculate_splits_or_http_error(bill, bill.get("split_method", "equal"))
    await db.bills.update_one({"bill_id": bill_id}, {"$push": {"participants": participant}, "$set": {"splits": splits, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await log_audit(user["user_id"], "add_participant", "bill", bill_id, data.name)
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

@api_router.delete("/bills/{bill_id}/participants/{participant_id}")
async def remove_participant(bill_id: str, participant_id: str, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user, owner_only=True)
    bill["participants"] = [p for p in bill["participants"] if p["participant_id"] != participant_id]
    for item in bill["items"]:
        item["assigned_to"] = [pid for pid in item.get("assigned_to", []) if pid != participant_id]
        item_assigned_quantities = item.get("assigned_quantities") or {}
        if participant_id in item_assigned_quantities:
            item_assigned_quantities.pop(participant_id, None)
            item["assigned_quantities"] = item_assigned_quantities
    totals = compute_bill_totals(bill)
    bill.update(totals)
    splits = calculate_splits_or_http_error(bill, bill.get("split_method", "equal"))
    await db.bills.update_one({"bill_id": bill_id}, {"$set": {"participants": bill["participants"], "items": bill["items"], **totals, "splits": splits, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

# ─── SPLITS ────────────────────────────────────────────────────────

@api_router.post("/bills/{bill_id}/split")
async def recalculate_split(bill_id: str, data: SplitRequest, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user, owner_only=True)
    splits = calculate_splits_or_http_error(bill, data.method, data.custom_splits, data.percentages)
    await db.bills.update_one({"bill_id": bill_id}, {"$set": {"splits": splits, "split_method": data.method, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

# ─── PAYMENTS (with idempotency) ──────────────────────────────────

@api_router.put("/bills/{bill_id}/payments/{participant_id}")
async def update_payment(bill_id: str, participant_id: str, data: PaymentUpdate, user: dict = Depends(get_current_user)):
    # Idempotency check
    if data.idempotency_key:
        existing_op = await db.idempotency_keys.find_one({"key": data.idempotency_key}, {"_id": 0})
        if existing_op:
            return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user)

    if bill.get("owner_id") != user.get("user_id"):
        matching_participant = next((p for p in bill.get("participants", []) if p.get("participant_id") == participant_id), None)
        participant_contact = str((matching_participant or {}).get("contact_info", "")).strip().lower()
        user_email = str(user.get("email", "")).strip().lower()
        if not matching_participant or not participant_contact or participant_contact != user_email:
            raise HTTPException(status_code=403, detail="Not authorized")

    splits = bill.get("splits", [])
    for s in splits:
        if s["participant_id"] == participant_id:
            s["amount_paid"] = data.amount_paid
            s["status"] = data.status
            break
    all_paid = all(s["status"] == "paid" for s in splits)
    bill_status = "settled" if all_paid and splits else "active"
    await db.bills.update_one({"bill_id": bill_id}, {"$set": {"splits": splits, "status": bill_status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    if data.idempotency_key:
        await db.idempotency_keys.insert_one({"key": data.idempotency_key, "bill_id": bill_id, "created_at": datetime.now(timezone.utc).isoformat()})
    await log_audit(user["user_id"], "update_payment", "bill", bill_id, f"participant={participant_id},status={data.status}")
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})

# ─── EXCHANGE RATES ────────────────────────────────────────────────

@api_router.get("/exchange-rates")
async def get_exchange_rate(base: str = "USD", target: str = "EUR"):
    cached = await db.exchange_rates.find_one({"base_currency": base.upper(), "target_currency": target.upper()}, {"_id": 0})
    if cached:
        fetched_at = cached.get("fetched_at", "")
        if isinstance(fetched_at, str):
            try:
                fetched_time = datetime.fromisoformat(fetched_at)
            except (ValueError, TypeError):
                fetched_time = datetime.min
        else:
            fetched_time = fetched_at
        if fetched_time.tzinfo is None:
            fetched_time = fetched_time.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - fetched_time < timedelta(hours=1):
            return cached
    try:
        async with httpx.AsyncClient() as hc:
            resp = await hc.get(f"https://api.frankfurter.dev/v1/latest?from={base.upper()}&to={target.upper()}", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            rate = data.get("rates", {}).get(target.upper(), 1.0)
            rate_doc = {"base_currency": base.upper(), "target_currency": target.upper(), "rate": rate, "fetched_at": datetime.now(timezone.utc).isoformat()}
            await db.exchange_rates.update_one({"base_currency": base.upper(), "target_currency": target.upper()}, {"$set": rate_doc}, upsert=True)
            return rate_doc
    except Exception as e:
        logger.error(f"Exchange rate fetch error: {e}")
    if cached:
        return cached
    return {"base_currency": base.upper(), "target_currency": target.upper(), "rate": 1.0, "fetched_at": datetime.now(timezone.utc).isoformat()}

@api_router.get("/currencies")
async def get_currencies():
    return {"currencies": ["USD","EUR","GBP","JPY","AUD","CAD","CHF","CNY","INR","SGD","HKD","NZD","KRW","MXN","BRL","ZAR","SEK","NOK","DKK","THB","IDR","MYR","PHP","TWD","TRY","PLN","CZK","HUF","ILS","AED"]}

# ─── SHARE LINKS ───────────────────────────────────────────────────

@api_router.post("/bills/{bill_id}/share")
async def create_share_link(bill_id: str, data: ShareLinkCreate, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    ensure_bill_access(bill, user, owner_only=True)
    existing = await db.share_links.find_one({"bill_id": bill_id}, {"_id": 0})
    if existing:
        return existing
    token = secrets.token_urlsafe(32)
    link = {"link_id": f"link_{uuid.uuid4().hex[:12]}", "bill_id": bill_id, "token": token, "expires_at": (datetime.now(timezone.utc) + timedelta(hours=data.expires_hours)).isoformat(), "public_access": data.public_access, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.share_links.insert_one(link)
    await log_audit(user["user_id"], "create_share_link", "bill", bill_id)
    link.pop("_id", None)
    return link

@api_router.get("/share/{token}")
async def view_shared_bill(token: str):
    link = await db.share_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    expires_at = link.get("expires_at", "")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Share link expired")
    bill = await db.bills.find_one({"bill_id": link["bill_id"]}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill

# ─── DASHBOARD STATS ──────────────────────────────────────────────

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    bills = await db.bills.find({"owner_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    preferred_currency = user.get("preferred_currency", "USD")
    
    total_bills = len(bills)
    active_bills = sum(1 for b in bills if b.get("status") == "active")
    settled_bills = sum(1 for b in bills if b.get("status") == "settled")
    
    # Convert all amounts to preferred currency
    total_amount = 0.0
    total_owed = 0.0
    total_paid = 0.0
    
    for b in bills:
        bill_currency = b.get("currency", "USD")
        bill_total = b.get("total_amount", 0)
        converted_total = await convert_currency(bill_total, bill_currency, preferred_currency)
        total_amount += converted_total
        
        for s in b.get("splits", []):
            amount_due = s.get("amount_due", 0)
            amount_paid = s.get("amount_paid", 0)
            converted_due = await convert_currency(amount_due, bill_currency, preferred_currency)
            converted_paid = await convert_currency(amount_paid, bill_currency, preferred_currency)
            total_owed += converted_due
            total_paid += converted_paid
    
    return {
        "total_bills": total_bills, "active_bills": active_bills, "settled_bills": settled_bills,
        "total_amount": round(total_amount, 2), "total_owed": round(total_owed, 2),
        "total_paid": round(total_paid, 2), "outstanding": round(total_owed - total_paid, 2),
        "currency": preferred_currency,
        "plan": user.get("plan", "free")
    }

# ─── ANALYTICS ENDPOINTS (Pro-gated) ──────────────────────────────

@api_router.get("/analytics/spending")
async def analytics_spending(user: dict = Depends(get_current_user), month: str = Query(None)):
    plan = user.get("plan", "free")
    is_pro = plan == "pro"
    preferred_currency = user.get("preferred_currency", "USD")
    
    # Use requested month or current month
    if not month:
        now = datetime.now(timezone.utc)
        month = now.strftime("%Y-%m")
    
    bills = await db.bills.find({"owner_id": user["user_id"]}, {"_id": 0}).to_list(5000)
    
    # Initialize weekly spending for selected month
    weekly_spending = {
        "1-7": 0.0,
        "8-14": 0.0,
        "15-21": 0.0,
        "22-28": 0.0,
        "29-31": 0.0,
    }
    
    for b in bills:
        created = b.get("created_at", "")
        if isinstance(created, str) and len(created) >= 10:
            try:
                # Parse date: YYYY-MM-DD
                bill_date_str = created.split('T')[0]
                bill_date = datetime.fromisoformat(bill_date_str)
                bill_month = bill_date_str[:7]  # YYYY-MM
                
                # Only count bills from selected month
                if bill_month == month:
                    day_of_month = bill_date.day
                    
                    # Determine week range
                    if day_of_month <= 7:
                        week_range = "1-7"
                    elif day_of_month <= 14:
                        week_range = "8-14"
                    elif day_of_month <= 21:
                        week_range = "15-21"
                    elif day_of_month <= 28:
                        week_range = "22-28"
                    else:
                        week_range = "29-31"
                    
                    bill_currency = b.get("currency", "USD")
                    bill_amount = b.get("total_amount", 0)
                    converted_amount = await convert_currency(bill_amount, bill_currency, preferred_currency)
                    weekly_spending[week_range] += converted_amount
            except (ValueError, IndexError):
                continue
    
    # Format result with all 5 weeks
    result = [
        {"dateRange": "1-7", "total": round(weekly_spending["1-7"], 2)},
        {"dateRange": "8-14", "total": round(weekly_spending["8-14"], 2)},
        {"dateRange": "15-21", "total": round(weekly_spending["15-21"], 2)},
        {"dateRange": "22-28", "total": round(weekly_spending["22-28"], 2)},
        {"dateRange": "29-31", "total": round(weekly_spending["29-31"], 2)},
    ]
    
    if not is_pro:
        result = [{"dateRange": r["dateRange"], "total": None, "locked": True} for r in result]
    
    return {"spending": result, "is_pro": is_pro, "currency": preferred_currency, "month": month}

@api_router.get("/analytics/currencies")
async def analytics_currencies(user: dict = Depends(get_current_user)):
    plan = user.get("plan", "free")
    preferred_currency = user.get("preferred_currency", "USD")
    
    bills = await db.bills.find({"owner_id": user["user_id"]}, {"_id": 0, "currency": 1, "total_amount": 1}).to_list(5000)
    currency_totals: Dict[str, float] = defaultdict(float)
    for b in bills:
        bill_currency = b.get("currency", "USD")
        bill_amount = b.get("total_amount", 0)
        # Convert to preferred currency
        converted_amount = await convert_currency(bill_amount, bill_currency, preferred_currency)
        # Still show the breakdown by original currency
        currency_totals[bill_currency] += converted_amount
    result = [{"currency": c, "total": round(t, 2)} for c, t in sorted(currency_totals.items(), key=lambda x: -x[1])]
    return {"currencies": result, "is_pro": plan == "pro", "preferred_currency": preferred_currency}

@api_router.get("/analytics/summary")
async def analytics_summary(user: dict = Depends(get_current_user)):
    bills = await db.bills.find({"owner_id": user["user_id"]}, {"_id": 0}).to_list(5000)
    preferred_currency = user.get("preferred_currency", "USD")
    
    # Convert all amounts to preferred currency
    total_spent = 0.0
    for b in bills:
        bill_currency = b.get("currency", "USD")
        bill_amount = b.get("total_amount", 0)
        converted_amount = await convert_currency(bill_amount, bill_currency, preferred_currency)
        total_spent += converted_amount
    
    avg_bill = total_spent / len(bills) if bills else 0
    total_participants = sum(len(b.get("participants", [])) for b in bills)
    top_currencies = defaultdict(int)
    for b in bills:
        top_currencies[b.get("currency", "USD")] += 1
    most_used_currency = max(top_currencies, key=top_currencies.get) if top_currencies else "USD"
    return {
        "total_spent": round(total_spent, 2),
        "total_bills": len(bills),
        "average_bill": round(avg_bill, 2),
        "total_participants": total_participants,
        "most_used_currency": most_used_currency,
        "preferred_currency": preferred_currency,
        "plan": user.get("plan", "free")
    }

# ─── RECEIPT SCANNING (OCR) ───────────────────────────────────────

@api_router.post("/ocr/scan-receipt")
async def scan_receipt(
    request: Request,
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    """
    Scan receipt image and extract items, prices, tax, total.
    
    Supports:
    - JPEG and PNG formats
    - Indonesian and English receipts
    - Multiple currency detection
    - Auto item/price extraction
    
    Returns structured receipt data ready for bill creation.
    """
    try:
        ocr_status = get_ocr_runtime_status()
        if not ocr_status.get("available"):
            raise HTTPException(status_code=500, detail=build_missing_ocr_error())

        image_bytes = b""
        image_source = ""
        image_content_type = None
        image_name = None

        # A) multipart/form-data upload path
        if file is not None:
            image_name = file.filename
            image_content_type = file.content_type
            logger.info(f"[OCR] Received multipart file: {image_name}, content_type: {image_content_type}")
            image_bytes = await file.read()
            image_source = "multipart"

        # B) application/json base64 DataURL path
        if not image_bytes:
            content_type_header = request.headers.get("content-type", "")
            if "application/json" in content_type_header or file is None:
                try:
                    payload = await request.json()
                except Exception as exc:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid request body. Send multipart file or JSON with image field"
                    ) from exc

                image_data = payload.get("image") if isinstance(payload, dict) else None
                if not image_data:
                    raise HTTPException(status_code=400, detail="No image provided. Send file or JSON image field")

                try:
                    image_bytes = decode_base64_image_data(str(image_data))
                except ValueError as validation_error:
                    raise HTTPException(status_code=400, detail=str(validation_error)) from validation_error

                image_source = "base64"
                image_content_type = "application/json"
                image_name = "base64-image"

        if not image_bytes:
            raise HTTPException(status_code=400, detail="No image provided. Send file or JSON image field")

        try:
            detected_format = validate_receipt_upload(image_name, image_content_type, image_bytes)
            logger.info(f"[OCR] Validated {image_source} image format={detected_format}, size={len(image_bytes)}")
        except ValueError as validation_error:
            raise HTTPException(status_code=400, detail=str(validation_error)) from validation_error
        
        # Extract text from image
        logger.info(f"[OCR] Scanning receipt for user {user['user_id']}, source={image_source}, size={len(image_bytes)} bytes")
        ocr_text = OCREngine.extract_text_from_image(image_bytes)
        logger.info(f"[OCR] Extracted {len(ocr_text)} characters of text")

        if not ocr_text.strip():
            raise HTTPException(status_code=400, detail="OCR returned empty text. Please retake the receipt photo in better lighting")
        
        # Parse receipt
        parsed = ReceiptParser.parse_receipt(ocr_text)
        if not parsed.get("items"):
            raise HTTPException(status_code=400, detail="Receipt format is not recognized. Please review or enter items manually")
        
        # Save image for attachment
        temp_image_id = f"receipt_{uuid.uuid4().hex[:12]}.png"
        await db.receipt_images.insert_one({
            "image_id": temp_image_id,
            "user_id": user["user_id"],
            "image_bytes": image_bytes,  # Store image for later attachment
            "ocr_text": ocr_text,
            "parsed_data": parsed,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Log audit
        await log_audit(user["user_id"], "scan_receipt", "ocr", temp_image_id, f"confidence={parsed['confidence']}")
        
        # Return parsed result with temp image ID
        return {
            "success": True,
            "image_id": temp_image_id,
            "currency": parsed["currency"],
            "items": [
                {"name": i["name"], "quantity": i["quantity"], "price": i["price"]}
                for i in parsed["items"]
            ],
            "subtotal": round(parsed["subtotal"], 2),
            "tax": round(parsed["tax"], 2),
            "service_charge": round(parsed["service_charge"], 2),
            "total": round(parsed["total"], 2),
            "confidence": round(parsed["confidence"], 2),
            "quality_metrics": parsed.get("quality_metrics", {}),
            "ocr_text": ocr_text  # For debugging/review
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors)
        raise
    except OCRError as e:
        logger.error(f"[OCR] OCR failed: {e}", exc_info=True)
        error_text = str(e).lower()
        if "no ocr provider" in error_text:
            raise HTTPException(status_code=500, detail=build_missing_ocr_error())
        if "empty text" in error_text:
            raise HTTPException(status_code=400, detail="OCR returned empty text. Please retake the receipt photo in better lighting")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")
    except Exception as e:
        logger.error(f"[OCR] Unexpected error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process receipt image: {type(e).__name__}")


@api_router.post("/ocr/rescan-cropped")
async def rescan_cropped_receipt(
    image_id: str = Form(...),
    crop_x: Optional[int] = Form(None),
    crop_y: Optional[int] = Form(None),
    crop_width: Optional[int] = Form(None),
    crop_height: Optional[int] = Form(None),
    crop_points_json: Optional[str] = Form(None),
    user: dict = Depends(get_current_user)
):
    """Rescan a cropped portion of a previously scanned receipt."""
    try:
        ocr_status = get_ocr_runtime_status()
        if not ocr_status.get("available"):
            raise HTTPException(status_code=500, detail=build_missing_ocr_error())

        receipt = await db.receipt_images.find_one({"image_id": image_id})
        if not receipt:
            raise HTTPException(status_code=404, detail="Receipt image not found")
        
        if receipt["user_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        from PIL import Image
        from io import BytesIO
        
        image_bytes = receipt["image_bytes"]
        img = Image.open(BytesIO(image_bytes))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        if crop_points_json:
            try:
                parsed_points = json.loads(crop_points_json)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=400, detail="crop_points_json must be valid JSON") from exc

            if not isinstance(parsed_points, list) or len(parsed_points) != 4:
                raise HTTPException(status_code=400, detail="crop_points_json must contain exactly 4 points")

            points: List[Tuple[float, float]] = []
            for entry in parsed_points:
                if not isinstance(entry, dict) or "x" not in entry or "y" not in entry:
                    raise HTTPException(status_code=400, detail="Each crop point must have x and y")
                try:
                    x = float(entry["x"])
                    y = float(entry["y"])
                except (TypeError, ValueError) as exc:
                    raise HTTPException(status_code=400, detail="Crop points must be numeric") from exc

                x = max(0.0, min(x, float(max(0, img.width - 1))))
                y = max(0.0, min(y, float(max(0, img.height - 1))))
                points.append((x, y))

            try:
                points = normalize_crop_points(points)
                validate_crop_quadrilateral(points)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            tl, tr, br, bl = points

            top_width = math.hypot(tr[0] - tl[0], tr[1] - tl[1])
            bottom_width = math.hypot(br[0] - bl[0], br[1] - bl[1])
            left_height = math.hypot(bl[0] - tl[0], bl[1] - tl[1])
            right_height = math.hypot(br[0] - tr[0], br[1] - tr[1])
            out_width = max(1, int(round(max(top_width, bottom_width))))
            out_height = max(1, int(round(max(left_height, right_height))))

            # PIL QUAD source order: top-left, bottom-left, bottom-right, top-right.
            quad = (tl[0], tl[1], bl[0], bl[1], br[0], br[1], tr[0], tr[1])
            cropped = img.transform((out_width, out_height), Image.Transform.QUAD, quad, resample=Image.Resampling.BICUBIC)

            min_x = min(p[0] for p in points)
            min_y = min(p[1] for p in points)
            max_x = max(p[0] for p in points)
            max_y = max(p[1] for p in points)
            crop_x = int(round(min_x))
            crop_y = int(round(min_y))
            crop_width = int(round(max_x - min_x))
            crop_height = int(round(max_y - min_y))
        else:
            if crop_x is None or crop_y is None or crop_width is None or crop_height is None:
                raise HTTPException(status_code=400, detail="Provide crop rectangle fields or crop_points_json")

            safe_x = max(0, int(crop_x))
            safe_y = max(0, int(crop_y))
            safe_w = max(1, int(crop_width))
            safe_h = max(1, int(crop_height))
            max_w = max(1, img.width - safe_x)
            max_h = max(1, img.height - safe_y)
            safe_w = min(safe_w, max_w)
            safe_h = min(safe_h, max_h)

            crop_x = safe_x
            crop_y = safe_y
            crop_width = safe_w
            crop_height = safe_h
            cropped = img.crop((crop_x, crop_y, crop_x + crop_width, crop_y + crop_height))
        
        cropped_bytes = BytesIO()
        cropped.save(cropped_bytes, format="PNG")
        cropped_bytes = cropped_bytes.getvalue()
        
        logger.info(f"[OCR] Rescanning cropped area of {image_id}")
        ocr_text = OCREngine.extract_text_from_image(cropped_bytes)
        if not ocr_text.strip():
            raise HTTPException(status_code=400, detail="OCR returned empty text for cropped area")
        parsed = ReceiptParser.parse_receipt(ocr_text)
        if not parsed.get("items"):
            raise HTTPException(status_code=400, detail="Cropped area does not contain recognizable receipt items")
        
        await log_audit(
            user["user_id"],
            "rescan_cropped",
            "ocr",
            image_id,
            f"crop=({crop_x},{crop_y},{crop_width},{crop_height}) points={bool(crop_points_json)} confidence={parsed['confidence']}"
        )
        
        return {
            "success": True,
            "image_id": image_id,
            "currency": parsed["currency"],
            "items": [
                {"name": i["name"], "quantity": i["quantity"], "price": i["price"], "confidence": i.get("confidence", 0.9)}
                for i in parsed["items"]
            ],
            "subtotal": round(parsed["subtotal"], 2),
            "tax": round(parsed["tax"], 2),
            "service_charge": round(parsed["service_charge"], 2),
            "total": round(parsed["total"], 2),
            "confidence": round(parsed["confidence"], 2),
            "quality_metrics": parsed.get("quality_metrics", {}),
            "ocr_text": ocr_text
        }
    
    except HTTPException:
        raise
    except OCRError as e:
        logger.error(f"[OCR] Rescan failed: {e}")
        raise HTTPException(status_code=500, detail=f"Rescan failed: {str(e)}")
    except Exception as e:
        logger.error(f"[OCR] Rescan error: {e}")
        raise HTTPException(status_code=500, detail="Failed to rescan receipt area")


@api_router.post("/ocr/suggest-crop")
async def suggest_crop_area(
    image_id: str = Form(...),
    user: dict = Depends(get_current_user),
):
    """Return an initial crop quadrilateral suggestion for manual adjustment."""
    receipt = await db.receipt_images.find_one({"image_id": image_id})
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt image not found")

    if receipt.get("user_id") != user.get("user_id"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    image_bytes = receipt.get("image_bytes")
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Receipt image has no data")

    try:
        points, source = suggest_receipt_crop_points(image_bytes)
    except Exception as exc:
        logger.warning(f"[OCR] suggest-crop fallback for {image_id}: {exc}")
        from io import BytesIO
        from PIL import Image

        with Image.open(BytesIO(image_bytes)) as src:
            points = default_crop_points(src.width, src.height)
            source = "fallback-error"

    return {
        "success": True,
        "image_id": image_id,
        "points": [
            {"x": round(point[0], 2), "y": round(point[1], 2)}
            for point in points
        ],
        "source": source,
    }


@api_router.post("/ocr/confirm-receipt")
async def confirm_receipt(
    request_data: dict,
    user: dict = Depends(get_current_user)
):
    """Confirm receipt OCR results and save to database."""
    try:
        image_id = request_data.get("image_id")
        currency = request_data.get("currency", "USD")
        items = request_data.get("items", [])
        subtotal = float(request_data.get("subtotal", 0))
        tax = float(request_data.get("tax", 0))
        service_charge = float(request_data.get("service_charge", 0))
        total = float(request_data.get("total", 0))
        confidence = float(request_data.get("confidence", 0.9))
        
        if not items:
            raise HTTPException(status_code=400, detail="No items in receipt")
        
        receipt_record = {
            "image_id": image_id,
            "user_id": user["user_id"],
            "currency": currency,
            "items": [
                {
                    "id": item.get("id", f"item_{uuid.uuid4().hex[:8]}"),
                    "name": item["name"],
                    "quantity": int(item.get("quantity", 1)),
                    "price": float(item["price"]),
                    "confidence": float(item.get("confidence", 0.9))
                }
                for item in items
            ],
            "subtotal": round(subtotal, 2),
            "tax": round(tax, 2),
            "service_charge": round(service_charge, 2),
            "total": round(total, 2),
            "confidence": round(confidence, 2),
            "status": "confirmed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = await db.receipt_confirmations.insert_one(receipt_record)
        
        await log_audit(
            user["user_id"],
            "receipt_confirmed",
            "ocr",
            image_id,
            f"items={len(items)} total={total} confidence={confidence}"
        )
        
        logger.info(f"[OCR] Receipt {image_id} confirmed for user {user['user_id']}")
        
        return {
            "success": True,
            "receipt_id": str(result.inserted_id) if result.inserted_id else image_id,
            "image_id": image_id,
            "bill_id": "",
            "message": "Receipt confirmed and ready to create bill"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[OCR] Confirm receipt failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to confirm receipt: {str(e)}")


# ─── OCR MODULE PLACEHOLDER (Feature-flagged) ─────────────────────

@api_router.post("/ocr/scan")
async def ocr_scan_receipt_legacy(user: dict = Depends(require_pro)):
    """OCR receipt scanning - Legacy. Use /ocr/scan-receipt instead."""
    return {
        "status": "deprecated",
        "message": "Use POST /api/ocr/scan-receipt instead",
        "supported_formats": ["image/jpeg", "image/png"],
        "provider": "tesseract-ocr"
    }

# ─── EXPORT MODULE PLACEHOLDER (Pro-gated) ────────────────────────

@api_router.post("/bills/{bill_id}/export/{format}")
async def export_bill(bill_id: str, format: str, user: dict = Depends(require_pro)):
    """Export bill as PDF/Excel/Image - Pro feature."""
    if format not in ("pdf", "excel", "image", "text"):
        raise HTTPException(status_code=400, detail="Invalid format. Supported: pdf, excel, image, text")
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {
        "status": "module_ready",
        "message": f"Export as {format.upper()} is prepared. Rendering engine pending activation.",
        "bill_id": bill_id,
        "format": format,
        "bill_title": bill.get("title"),
        "total": bill.get("total_amount")
    }

# ─── HEALTH ────────────────────────────────────────────────────────

@api_router.get("/health")
async def health():
    ocr_status = get_ocr_runtime_status()
    return {
        "status": "ok",
        "service": "SplitBill Pro API",
        "version": "2.0.0",
        "environment": "production-ready",
        "ocr": {
            "available": bool(ocr_status.get("available")),
            "version": ocr_status.get("version"),
            "binary": ocr_status.get("binary"),
        },
    }

# ─── SETUP ─────────────────────────────────────────────────────────

# Middleware order matters: first added = outermost
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
