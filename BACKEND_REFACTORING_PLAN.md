"""
BACKEND REFACTORING GUIDE
Mengorganisir server.py yang 1166 lines menjadi multiple modular files

CURRENT PROBLEM:
- server.py adalah monolithic: 1166 lines
- Mix dari config, models, middleware, routes, business logic
- Sulit untuk test, maintain, dan scale
- Duplicate code di beberapa tempat

PROPOSED STRUCTURE:
backend/
├── server.py                 (entry point, ~50 lines)
├── config.py                (configuration, constants)
├── models.py                (Pydantic models)
├── middleware.py            (Custom middleware)
├── dependencies.py          (Auth, rate limiting helpers)
├── routes/
│   ├── __init__.py
│   ├── auth.py
│   ├── bills.py
│   ├── items.py
│   ├── participants.py
│   ├── payments.py
│   ├── splits.py
│   ├── analytics.py
│   └── ocr.py
├── services/
│   ├── __init__.py
│   ├── bill_service.py     (Business logic untuk bill)
│   ├── payment_service.py  (Payment calculations)
│   ├── split_service.py    (Split logic)
│   └── ocr_service.py      (OCR wrapper)
└── utils/
    ├── __init__.py
    ├── logger.py           (Structured logging)
    └── errors.py           (Custom exceptions)

BENEFITS:
✓ Clear separation of concerns
✓ Easy to locate functionality
✓ Can test services independently
✓ Routes are focused on HTTP handling only
✓ Business logic separated dari API details
✓ Easy to add new features without affecting others
✓ Multiple developers dapat work on different routes simultaneously

IMPLEMENTATION STEPS:

1. CREATE config.py
   - Move PLAN_LIMITS
   - Move RATE_LIMIT constants
   - Move environment variables loading
   
2. CREATE models.py
   - Move all Pydantic models
   - Organize by logical groups (Auth, Bill, Payment, etc)
   - Add docstrings untuk setiap model
   
3. CREATE middleware.py
   - Move all middleware classes
   - Keep logger setup di sini
   
4. CREATE dependencies.py
   - Move auth function (get_current_user, etc)
   - Move feature gate helpers
   - Move rate limiter class
   
5. CREATE routes/__init__.py
   - Import all route routers
   - Register ke main app
   
6. CREATE routes/bills.py
   - Move semua bill endpoints
   - Move bill creation logic
   - Move bill update/delete
   
7. (Similar untuk routes lainnya)
   
8. CREATE services/bill_service.py
   - Extract business logic dari routes
   - Separate HTTP handling dari business rules
   
9. UPDATE server.py
   - Import dari all new modules
   - Setup FasAPI app
   - Register middleware
   - Register routers
   - Keep hanya ~50 lines

EXAMPLE REFACTORING (models.py):

```python
# models.py
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime

# ─────── Auth Models ──────────
class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    plan: str = "free"
    created_at: Optional[str] = None

class SessionExchange(BaseModel):
    session_id: str
    
    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        if not v or len(v) < 5:
            raise ValueError("Invalid session_id")
        return v.strip()

# ─────── Bill Models ──────────
class BillItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0, le=1000000)
    quantity: int = Field(ge=1, le=1000, default=1)
    assigned_to: List[str] = []
    
    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return v.strip()

class ParticipantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    contact_info: Optional[str] = ""
    
    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return v.strip()

class BillCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    items: List[BillItemCreate] = []
    participants: List[ParticipantCreate] = []
    tax_type: str = "percentage"
    tax_value: float = Field(default=0, ge=0, le=100000)
    service_charge: float = Field(default=0, ge=0, le=100000)
    split_method: str = "equal"
    
    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        return v.strip()
    
    @field_validator("split_method")
    @classmethod
    def validate_split(cls, v: str) -> str:
        allowed = ("equal", "per_item", "percentage", "custom")
        if v not in allowed:
            raise ValueError(f"Invalid split method. Must be one of {allowed}")
        return v
    
    @field_validator("tax_type")
    @classmethod
    def validate_tax_type(cls, v: str) -> str:
        if v not in ("percentage", "fixed"):
            raise ValueError("Invalid tax type")
        return v

# ✓ Grouped by feature, easy to find, easy to extend
```

EXAMPLE REFACTORING (routes/bills.py):

```python
# routes/bills.py
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List
from models import BillCreate, BillUpdate, BillOut
from dependencies import get_current_user
from services.bill_service import (
    create_bill,
    get_bill,
    update_bill,
    delete_bill,
    get_user_bills,
)

router = APIRouter(prefix="/bills", tags=["Bills"])

@router.post("/", response_model=dict)
async def create_bill_endpoint(
    request: Request,
    bill_data: BillCreate,
    user: dict = Depends(get_current_user),
):
    \"\"\"Create a new bill\"\"\"
    try:
        result = await create_bill(bill_data, user)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{bill_id}")
async def get_bill_endpoint(
    bill_id: str,
    user: dict = Depends(get_current_user),
):
    \"\"\"Get bill by ID\"\"\"
    bill = await get_bill(bill_id, user)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill

@router.get("/")
async def list_bills_endpoint(
    user: dict = Depends(get_current_user),
):
    \"\"\"List user's bills\"\"\"
    bills = await get_user_bills(user['user_id'])
    return bills

@router.put("/{bill_id}")
async def update_bill_endpoint(
    bill_id: str,
    bill_data: BillUpdate,
    user: dict = Depends(get_current_user),
):
    \"\"\"Update bill\"\"\"
    updated = await update_bill(bill_id, bill_data, user)
    if not updated:
        raise HTTPException(status_code=404, detail="Bill not found")
    return updated

@router.delete("/{bill_id}")
async def delete_bill_endpoint(
    bill_id: str,
    user: dict = Depends(get_current_user),
):
    \"\"\"Delete bill\"\"\"
    success = await delete_bill(bill_id, user)
    if not success:
        raise HTTPException(status_code=404, detail="Bill not found")
    return {"message": "Bill deleted"}

# ✓ Routes hanya handle HTTP, delegate ke services
# ✓ Easy to test - dapat test services tanpa mocking HTTP
```

EXAMPLE REFACTORING (services/bill_service.py):

```python
# services/bill_service.py
from models import BillCreate, BillUpdate
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any

async def create_bill(bill_data: BillCreate, user: dict) -> Dict[str, Any]:
    \"\"\"
    Create bill dengan validation dan business rules
    - Validate participants count
    - Calculate splits
    - Save ke database
    \"\"\"
    # Validation
    if len(bill_data.participants) == 0:
        raise ValueError("Bill must have at least one participant")
    
    if len(bill_data.items) == 0:
        raise ValueError("Bill must have at least one item")
    
    # Calculate totals
    subtotal = sum(
        Decimal(str(item.price)) * item.quantity
        for item in bill_data.items
    )
    
    if bill_data.tax_type == "percentage":
        tax = subtotal * Decimal(str(bill_data.tax_value)) / 100
    else:
        tax = Decimal(str(bill_data.tax_value))
    
    total = subtotal + tax + Decimal(str(bill_data.service_charge))
    
    # Save ke database
    bill_doc = {
        "title": bill_data.title,
        "currency": bill_data.currency,
        "owner_id": user['user_id'],
        "items": [item.dict() for item in bill_data.items],
        "participants": [p.dict() for p in bill_data.participants],
        "subtotal": float(subtotal),
        "tax": float(tax),
        "total": float(total),
        "split_method": bill_data.split_method,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }
    
    # Insert dan return
    result = await db.bills.insert_one(bill_doc)
    
    return {
        "bill_id": str(result.inserted_id),
        "total": float(total),
    }

async def get_bill(bill_id: str, user: dict) -> Optional[Dict]:
    \"\"\"Get single bill dengan authorization check\"\"\"
    from bson import ObjectId
    
    bill = await db.bills.find_one({
        "_id": ObjectId(bill_id),
        "owner_id": user['user_id'],
    })
    return bill

# ✓ Business logic terpisah dari HTTP concerns
# ✓ Dapat di-test dengan simple function calls
# ✓ Reusable dari multiple routes/contexts
```

MIGRATION CHECKLIST:

□ Create config.py dengan constants
□ Create models.py dengan semua Pydantic models
□ Create middleware.py dengan middleware classes
□ Create dependencies.py dengan auth logic
□ Create routes/__init__.py
□ Create routes/bills.py
□ Create routes/auth.py
□ Create routes/items.py (jika ada)
□ Create routes/participants.py (jika ada)
□ Create services/bill_service.py dengan business logic
□ Create services/payment_service.py (jika ada)
□ Update server.py (simplify ke ~50 lines)
□ Update imports di semua files
□ Test setiap route endpoint
□ Update requirements.txt jika ada dependencies baru

QUICK WINS (Start Here):

1. Create config.py - 5 minutes
   - Copy PLAN_LIMITS
   - Copy rate limit config
   - Set defaults
   
2. Create models.py - 10 minutes
   - Copy ALL pydantic models
   - Group by feature
   - Add docstrings

3. Split routes ke routes/bills.py - 15 minutes
   - Copy bill endpoints je ke new file
   - Create APIRouter
   - Update server.py imports

Start dengan 1 feature (e.g. bills), bukan semua sekaligus.
Setelah 1 feature berhasil, lanjut ke feature lainnya.

QUESTIONS?

Hubungi team jika ada yang ambiguous.
Keep branch untuk refactoring separate dari main.
Test comprehensively sebelum merge.
"""
