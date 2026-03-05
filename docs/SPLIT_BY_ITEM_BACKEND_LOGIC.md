/* 
 * SPLIT_BY_ITEM_BACKEND_LOGIC.md
 * 
 * Dokumentasi lengkap backend logic untuk Split Bill by Item
 * Covers: Data models, API endpoints, calculation logic, dan edge cases
 */

# Split Bill by Item - Backend Logic Documentation

## 1. DATA MODELS

### BillItemCreate (Input)

```python
class BillItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: float = Field(gt=0, le=1000000)
    quantity: int = Field(ge=1, le=1000, default=1)
    assigned_to: List[str] = []  # Empty = will distribute to all
```

**Example:**
```json
{
  "name": "Nasi Goreng Spesial",
  "price": 15000,
  "quantity": 2,
  "assigned_to": []
}
```

### BillItemUpdate (Update)

```python
class BillItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    price: Optional[float] = Field(None, gt=0, le=1000000)
    quantity: Optional[int] = Field(None, ge=1, le=1000)
    assigned_to: Optional[List[str]] = None  # Can be updated
```

**Example:**
```json
{
  "assigned_to": ["part_kenji_001", "part_fico_001"]
}
```

### Item Document (Stored)

```json
{
  "item_id": "item_abc123",
  "name": "Nasi Goreng Spesial",
  "price": 15000,
  "quantity": 2,
  "assigned_to": ["part_kenji_001", "part_fico_001"]
}
```

---

## 2. API ENDPOINTS

### POST /api/bills/{bill_id}/items - Add Item

```
REQUEST:
POST /api/bills/bill_123/items

{
  "name": "Nasi Goreng",
  "price": 10000,
  "quantity": 2,
  "assigned_to": []
}

RESPONSE (200):
{
  "bill_id": "bill_123",
  "items": [{...}, {...}],
  "participants": [{...}],
  "splits": [
    {
      "participant_id": "part_001",
      "participant_name": "Kenji",
      "amount_due": 20000,
      "amount_paid": 0,
      "status": "unpaid"
    },
    ...
  ],
  "split_method": "per_item",
  ...
}
```

### PUT /api/bills/{bill_id}/items/{item_id} - Update Item

```
REQUEST:
PUT /api/bills/bill_123/items/item_456

{
  "assigned_to": ["part_001", "part_002"]
}

PROCESSING:
1. Find item dengan item_id = item_456
2. Update field assigned_to = ["part_001", "part_002"]
3. Recalculate bill totals
4. Recalculate splits dengan method yang ada
5. Return updated bill dengan new splits

RESPONSE (200):
{
  "bill_id": "bill_123",
  "items": [
    {
      "item_id": "item_456",
      "name": "Nasi Goreng",
      "price": 10000,
      "quantity": 2,
      "assigned_to": ["part_001", "part_002"]  // ← Updated
    },
    ...
  ],
  "splits": [
    {
      "participant_id": "part_001",
      "amount_due": 10000 * 2 / 2 = 10000,  // ← Recalculated
      ...
    },
    {
      "participant_id": "part_002",
      "amount_due": 10000 * 2 / 2 = 10000,  // ← Recalculated
      ...
    },
    {
      "participant_id": "part_003",
      "amount_due": 0,  // ← Not assigned
      ...
    }
  ],
  ...
}
```

### DELETE /api/bills/{bill_id}/items/{item_id} - Delete Item

```
REQUEST:
DELETE /api/bills/bill_123/items/item_456

PROCESSING:
1. Remove item dari items array
2. Recalculate bill totals
3. Recalculate splits
4. Return updated bill

RESPONSE (200):
{
  "bill_id": "bill_123",
  "items": [/* item_456 dihapus */],
  "splits": [/* recalculated */],
  ...
}
```

### DELETE /api/bills/{bill_id}/participants/{participant_id} - Remove Participant

```
REQUEST:
DELETE /api/bills/bill_123/participants/part_456

PROCESSING:
1. Remove participant dari participants array
2. Remove participant dari assigned_to SEMUA items
3. Recalculate bill totals
4. Recalculate splits
5. Return updated bill

EXAMPLE:
- Sebelum: item.assigned_to = ["part_001", "part_456", "part_789"]
- Sesudah: item.assigned_to = ["part_001", "part_789"]

RESPONSE (200):
{
  "bill_id": "bill_123",
  "participants": [/* part_456 removed */],
  "items": [/* assigned_to updated di semua items */],
  "splits": [/* recalculated tanpa part_456 */],
  ...
}
```

### POST /api/bills/{bill_id}/split - Recalculate Split

```
REQUEST:
POST /api/bills/bill_123/split

{
  "method": "per_item"
}

PROCESSING:
- Ambil saat ini split_method dari bill
- Jika method params dikirim, ganti dengan method baru
- Recalculate splits dengan method yang ditentukan
- Return updated bill

RESPONSE (200):
{
  "bill_id": "bill_123",
  "split_method": "per_item",
  "splits": [/* recalculated */],
  ...
}
```

---

## 3. CALCULATION LOGIC

### Main Algorithm: calculate_splits()

```python
def calculate_splits(bill: dict, method: str = "equal") -> list:
    """
    Hitung pembagian biaya per person berdasarkan split method.
    
    Args:
        bill: Bill dict dengan items, participants, tax, service_charge
        method: "equal", "per_item", "percentage", "custom"
    
    Returns:
        List of splits dengan struktur:
        {
            "participant_id": str,
            "participant_name": str,
            "amount_due": float,
            "amount_paid": float,
            "status": "paid" | "unpaid"
        }
    """
    
    participants = bill.get("participants", [])
    items = bill.get("items", [])
    
    if method == "per_item":
        return calculate_splits_per_item(bill, items, participants)
    elif method == "equal":
        return calculate_splits_equal(bill, items, participants)
    # ... handle other methods
```

### Per-Item Calculation Logic

```python
def calculate_splits_per_item(bill: dict, items: list, participants: list) -> list:
    """
    Split per item berdasarkan assigned_to.
    """
    
    # 1. Initialize totals untuk setiap participant
    participant_totals = {}
    for p in participants:
        participant_totals[p["participant_id"]] = Decimal("0")
    
    unassigned_total = Decimal("0")
    
    # 2. Process setiap item
    for item in items:
        item_total = Decimal(str(item["price"])) * Decimal(str(item["quantity"]))
        assigned = item.get("assigned_to", [])
        
        if assigned:  # Ada yang di-assign
            # Bagikan hanya ke orang yang di-assign
            share = (item_total / len(assigned)).quantize(
                Decimal("0.01"), 
                rounding=ROUND_HALF_UP
            )
            for participant_id in assigned:
                if participant_id in participant_totals:
                    participant_totals[participant_id] += share
        else:  # Tidak ada yang di-assign = bagikan ke semua
            unassigned_total += item_total
    
    # 3. Bagikan unassigned items ke semua orang secara equal
    if unassigned_total > 0 and participants:
        share = unassigned_total / len(participants)
        for p_id in participant_totals:
            participant_totals[p_id] += share
    
    # 4. Add tax & service charge (proportional)
    tax_amount = Decimal(str(bill.get("tax_amount", 0)))
    service_charge = Decimal(str(bill.get("service_charge", 0)))
    bill_subtotal = sum(
        Decimal(str(item["price"])) * Decimal(str(item["quantity"]))
        for item in items
    )
    
    for p_id in participant_totals:
        if bill_subtotal > 0:
            # Persentase dari subtotal
            proportion = participant_totals[p_id] / bill_subtotal
            participant_totals[p_id] += tax_amount * proportion
            participant_totals[p_id] += service_charge * proportion
    
    # 5. Build splits list
    splits = []
    for p in participants:
        p_id = p["participant_id"]
        existing_split = next(
            (s for s in bill.get("splits", []) if s["participant_id"] == p_id),
            None
        )
        
        splits.append({
            "participant_id": p_id,
            "participant_name": p["name"],
            "amount_due": float(participant_totals[p_id]),
            "amount_paid": existing_split["amount_paid"] if existing_split else 0,
            "status": existing_split["status"] if existing_split else "unpaid"
        })
    
    return splits
```

**Contoh Calculation:**

```
Items:
  - Nasi Goreng (10000 × 2) assigned_to [part_001, part_002]
  - Mie Goreng (12000 × 1) assigned_to [part_001]
  - Es Teh (5000 × 3) assigned_to [part_001, part_002, part_003]

Step 1: Initialize
  part_001: 0
  part_002: 0
  part_003: 0

Step 2: Process items
  Nasi Goreng: 20000 ÷ 2 = 10000 per person
    part_001: +10000 = 10000
    part_002: +10000 = 10000
  
  Mie Goreng: 12000 ÷ 1 = 12000
    part_001: +12000 = 22000
  
  Es Teh: 15000 ÷ 3 = 5000 per person
    part_001: +5000 = 27000
    part_002: +5000 = 15000
    part_003: +5000 = 5000

Step 3: Unassigned items
  (none in this example)

Step 4: Add tax/service
  (assume 0 for simplicity)

Final:
  part_001: 27000
  part_002: 15000
  part_003: 5000
  TOTAL:    47000 ✓
```

---

## 4. EDGE CASES

### Case 1: Item dengan assigned_to = []

```python
# Jika user tidak assign siapa-siapa:
if assigned == []:
    # Treat sebagai "semua orang bayar"
    share = item_total / len(participants)
    for p_id in participant_totals:
        participant_totals[p_id] += share
```

### Case 2: Participant Dihapus

```python
@api_router.delete("/bills/{bill_id}/participants/{participant_id}")
async def remove_participant(bill_id: str, participant_id: str, ...):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    
    # Remove dari participants list
    bill["participants"] = [
        p for p in bill["participants"] 
        if p["participant_id"] != participant_id
    ]
    
    # IMPORTANT: Clean up dari semua items
    for item in bill["items"]:
        item["assigned_to"] = [
            pid for pid in item.get("assigned_to", [])
            if pid != participant_id
        ]
    
    # Recalculate
    totals = compute_bill_totals(bill)
    bill.update(totals)
    splits = calculate_splits(bill, bill.get("split_method", "equal"))
    
    # Save
    await db.bills.update_one(
        {"bill_id": bill_id},
        {
            "$set": {
                "participants": bill["participants"],
                "items": bill["items"],
                **totals,
                "splits": splits
            }
        }
    )
```

### Case 3: Tax Distribution

```python
# Distributed proportional to subtotal contribution
for p_id in participant_totals:
    if bill_subtotal > 0:
        proportion = participant_totals[p_id] / bill_subtotal
    else:
        proportion = 1 / len(participants)
    
    # Add tax & service proportionally
    participant_totals[p_id] += tax_amount * proportion
    participant_totals[p_id] += service_charge * proportion
```

### Case 4: Rounding Issues

```python
from decimal import Decimal, ROUND_HALF_UP

# Always use Decimal untuk precision
share = (item_total / len(assigned)).quantize(
    Decimal("0.01"),  # Round to 2 decimal places
    rounding=ROUND_HALF_UP
)
```

---

## 5. STATUS TRANSITIONS

### Payment Status

```
Initial: "unpaid"
         ↓
Toggle Payment: "paid" ↔ "unpaid"

amount_paid = 0 (unpaid) or amount_due (paid)
```

```python
async def update_payment(bill_id: str, participant_id: str, data: PaymentUpdate, ...):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    
    splits = bill.get("splits", [])
    for i, split in enumerate(splits):
        if split["participant_id"] == participant_id:
            splits[i]["status"] = data.status
            splits[i]["amount_paid"] = data.amount_paid
            break
    
    bill["splits"] = splits
    await db.bills.update_one(
        {"bill_id": bill_id},
        {"$set": {"splits": splits}}
    )
```

---

## 6. DATABASE OPERATIONS

### Create Bill

```python
@api_router.post("/bills")
async def create_bill(data: BillCreate, user: dict = Depends(get_current_user)):
    bill_id = f"bill_{uuid.uuid4().hex[:12]}"
    
    # Initialize items dengan assigned_to sebagai list kosong atau dari data
    items = []
    for item_data in data.items:
        items.append({
            "item_id": f"item_{uuid.uuid4().hex[:12]}",
            "name": item_data.name,
            "price": item_data.price,
            "quantity": item_data.quantity,
            "assigned_to": item_data.assigned_to or []
        })
    
    # Initialize participants
    participants = [
        {
            "participant_id": f"part_{uuid.uuid4().hex[:12]}",
            "name": user["name"],
            "contact_info": user.get("email", ""),
            "is_owner": True
        }
    ]
    
    for p_data in data.participants:
        participants.append({
            "participant_id": f"part_{uuid.uuid4().hex[:12]}",
            "name": p_data.name,
            "contact_info": p_data.contact_info or "",
            "is_owner": False
        })
    
    # Calculate initial splits
    bill = {...}
    splits = calculate_splits(bill, data.split_method)
    bill["splits"] = splits
    
    # Save
    await db.bills.insert_one(bill)
    return bill
```

### Update Item (UpdateAssigned_to)

```python
@api_router.put("/bills/{bill_id}/items/{item_id}")
async def update_item(bill_id: str, item_id: str, data: BillItemUpdate, ...):
    bill = await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
    
    # Find dan update item
    items = bill.get("items", [])
    for i, item in enumerate(items):
        if item["item_id"] == item_id:
            # Update fields dari data
            for k, v in data.model_dump(exclude_unset=True).items():
                if v is not None:
                    items[i][k] = v
            break
    
    # Recalculate
    bill["items"] = items
    totals = compute_bill_totals(bill)
    bill.update(totals)
    splits = calculate_splits(bill, bill.get("split_method", "equal"))
    
    # Save
    await db.bills.update_one(
        {"bill_id": bill_id},
        {"$set": {
            "items": items,
            **totals,
            "splits": splits,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return await db.bills.find_one({"bill_id": bill_id}, {"_id": 0})
```

---

## 7. ERROR HANDLING

```python
# 404 - Bill not found
if not bill:
    raise HTTPException(status_code=404, detail="Bill not found")

# 400 - Invalid data
if not item_id in [i["item_id"] for i in bill["items"]]:
    raise HTTPException(
        status_code=400,
        detail="Item not found in this bill"
    )

# 400 - Invalid participant
invalid_participants = [
    pid for pid in data.assigned_to
    if not any(p["participant_id"] == pid for p in bill["participants"])
]
if invalid_participants:
    raise HTTPException(
        status_code=400,
        detail=f"Invalid participants: {invalid_participants}"
    )
```

---

## 8. VALIDATION

```python
# BillItemCreate validation
class BillItemCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=200,
        description="Item name must be 1-200 characters"
    )
    price: float = Field(
        gt=0,
        le=1000000,
        description="Price must be > 0 and <= 1,000,000"
    )
    quantity: int = Field(
        ge=1,
        le=1000,
        default=1,
        description="Quantity must be 1-1000"
    )
    assigned_to: List[str] = Field(
        default_factory=list,
        description="List of participant IDs"
    )
    
    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return v.strip()
    
    @field_validator("assigned_to")
    @classmethod
    def validate_assigned_to(cls, v: List[str]) -> List[str]:
        # Remove duplicates
        return list(set(v))
```

---

## 9. PERFORMANCE CONSIDERATIONS

```python
# Index untuk fast lookup
db.bills.create_index([("split_method", 1)])
db.bills.create_index([("items.assigned_to", 1)])

# Batch recalculation jika banyak items
# Gunakan Decimal untuk accuracy, bukan float
# Cache splits calculation hasil jika perlu
```

---

**Version:** 1.0
**Last Updated:** March 3, 2026
**Language:** Python (FastAPI + MongoDB)
