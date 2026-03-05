# Split Bill by Item - Complete Guide

## Overview

Fitur "Split Bill by Item" memungkinkan user untuk membagi tagihan berdasarkan item secara granular. Setiap item makanan bisa dipilih siapa saja yang ikut membayarnya, sehingga perhitungan menjadi lebih fleksibel dan adil.

## Data Structure

### Item Object

```typescript
interface BillItem {
  item_id: string;           // Unique ID (e.g., "item_abc123")
  name: string;              // Nama item (e.g., "Nasi Goreng")
  price: number;             // Harga satuan (e.g., 10000)
  quantity: number;          // Jumlah (e.g., 2)
  assigned_to: string[];     // Array participant_id yang ikut bayar
}
```

### Participant Object

```typescript
interface Participant {
  participant_id: string;    // Unique ID (e.g., "part_xyz789")
  name: string;              // Nama orang (e.g., "Kenji")
  contact_info: string;      // Email atau nomor HP
  is_owner: boolean;         // Apakah pembuat bill
}
```

### Bill Object

```typescript
interface Bill {
  bill_id: string;
  title: string;
  currency: string;          // e.g., "IDR", "USD"
  items: BillItem[];
  participants: Participant[];
  split_method: "equal" | "per_item" | "percentage" | "custom";
  subtotal: number;
  tax_amount: number;
  service_charge: number;
  total_amount: number;
  splits: Split[];           // Calculated splits per participant
}
```

## Backend Logic

### Calculation Flow

Ketika `split_method` adalah `"per_item"`:

```python
def calculate_splits(bill: dict, method: str = "per_item") -> list:
    """
    Untuk setiap item:
    1. Hitung total item = price × quantity
    2. Jika assigned_to kosong = bagikan ke semua orang
    3. Jika assigned_to tidak kosong = bagikan hanya ke orang yang dipilih
    4. Bagi total item ke jumlah orang yang assign
    """
    
    participant_totals = {p["participant_id"]: 0 for p in participants}
    
    for item in items:
        item_total = item["price"] * item["quantity"]
        assigned = item.get("assigned_to", [])
        
        if assigned:
            # Ada yang dipilih - bagikan hanya ke orang yang dipilih
            share = item_total / len(assigned)
            for participant_id in assigned:
                participant_totals[participant_id] += share
        else:
            # Tidak ada yang dipilih - bagikan ke semua
            share = item_total / len(participants)
            for participant_id in participant_totals:
                participant_totals[participant_id] += share
    
    # Tambah tax dan service charge
    # ... (logic distribusi tax/service sesuai per_item)
    
    return splits_list
```

### API Endpoints

1. **Add Item**
   ```
   POST /api/bills/{bill_id}/items
   
   Body: {
     "name": "Nasi Goreng",
     "price": 10000,
     "quantity": 2,
     "assigned_to": ["part_123", "part_456"]  // Optional kosong di awal
   }
   ```

2. **Update Item (untuk ubah assigned_to)**
   ```
   PUT /api/bills/{bill_id}/items/{item_id}
   
   Body: {
     "assigned_to": ["part_123", "part_456", "part_789"]
   }
   ```

3. **Recalculate Splits**
   ```
   POST /api/bills/{bill_id}/split
   
   Body: {
     "method": "per_item"
   }
   
   Backend akan otomatis recalculate berdasarkan assigned_to setiap item
   ```

## Frontend Implementation

### User Interface Flow

#### 1. Creating Bill with Item Selection

**Create Bill Screen** (`/create-bill.tsx`)

```tsx
// User bisa add items dengan data:
const items = [
  { name: "Nasi Goreng", price: "10000", quantity: "2" },
  { name: "Mie Goreng", price: "12000", quantity: "1" }
];

const participants = [
  { name: "Kenji" },
  { name: "Fico" },
  { name: "Lisa" }
];

// Di awal, semua item assigned_to = [] (empty)
// Akan dijelaskan per-item saat di bill detail
```

#### 2. Editing Item Participants (Bill Detail Screen)

**Features:**

1. **Pills menampilkan siapa yang bayar per item**
   ```
   [Item Name] x2 @ Rp10.000
   Split among: Kenji  Fico  Lisa    [Edit Icon]
   ```

2. **Edit Mode**
   - Klik icon "people" → modal selection
   - Checkbox untuk setiap participant
   - Save perubahan

**Component Structure:**
```tsx
{bill.split_method === 'per_item' && (
  <>
    {/* Items Breakdown Section */}
    {bill.items.map(item => (
      <View key={item.item_id}>
        {/* Item Name, Price, Actions */}
        
        {/* Show Assigned Participants */}
        {item.assigned_to.length > 0 && (
          <View style={styles.itemAssignedInfo}>
            Split among: <Tags for each participant/>
          </View>
        )}
        
        {/* Edit Mode - Checkboxes */}
        {editingItemId === item.item_id && (
          <View>
            {bill.participants.map(p => (
              <Checkbox
                checked={editingItemAssignedTo.includes(p.id)}
                onChange={() => handleToggle(p.id)}
              />
            ))}
            <Button onPress={handleSave}>Save</Button>
          </View>
        )}
      </View>
    ))}
    
    {/* Total Per Person Summary */}
    <View>
      <Text>Total Per Person</Text>
      {bill.splits.map(split => (
        <SplitCard participant={split.participant_name} amount={split.amount_due}/>
      ))}
    </View>
  </>
)}
```

### State Management

```tsx
const [bill, setBill] = useState(null);
const [editingItemId, setEditingItemId] = useState<string | null>(null);
const [editingItemAssignedTo, setEditingItemAssignedTo] = useState<string[]>([]);
```

### Handler Functions

```tsx
// Mulai edit item
const handleEditItemAssignedTo = (itemId: string, currentAssignedTo: string[]) => {
  setEditingItemId(itemId);
  setEditingItemAssignedTo([...currentAssignedTo]);
};

// Toggle participant selection
const handleToggleParticipantForItem = (participantId: string) => {
  setEditingItemAssignedTo(prev =>
    prev.includes(participantId)
      ? prev.filter(id => id !== participantId)
      : [...prev, participantId]
  );
};

// Simpan ke backend
const handleSaveItemAssignedTo = async () => {
  const updated = await api.updateItem(billId, editingItemId, {
    assigned_to: editingItemAssignedTo
  });
  setBill(updated);
  setEditingItemId(null);
};
```

## Usage Example

### Scenario: Makan Bersama 3 Orang

**Initial Setup:**
- Bill: "Dinner at Restaurant XYZ"
- Currency: "IDR"
- Participants: Kenji (owner), Fico, Lisa
- Split Method: "By Item"

**Items & Split:**

| Item | Price | Qty | Total | Assigned To |
|------|-------|-----|-------|-------------|
| Nasi Goreng | 10,000 | 2 | 20,000 | Kenji, Fico |
| Mie Goreng | 12,000 | 1 | 12,000 | Kenji |
| Minuman | 5,000 | 3 | 15,000 | Kenji, Fico, Lisa |

**Calculation:**

```
Kenji:
  - Nasi Goreng: 20,000 ÷ 2 = 10,000
  - Mie Goreng: 12,000 ÷ 1 = 12,000
  - Minuman: 15,000 ÷ 3 = 5,000
  → Total: 27,000

Fico:
  - Nasi Goreng: 20,000 ÷ 2 = 10,000
  - Minuman: 15,000 ÷ 3 = 5,000
  → Total: 15,000

Lisa:
  - Minuman: 15,000 ÷ 3 = 5,000
  → Total: 5,000

Grand Total: 27,000 + 15,000 + 5,000 = 47,000
```

## UI Components Summary

### New Styles Added

```tsx
// Item additional info
itemAssignedInfo
assignedInfoLabel
assignedInfoTags
assignedTag

// Edit mode
itemEditSection
editSectionTitle
participantCheckRow
checkbox
checkboxChecked
participantCheckLabel
editActionRow
editBtn
editBtnCancel
editBtnSave
editBtnText
```

## Features Implemented

✅ **Create Bill** - Add items dengan initial assigned_to = []
✅ **View Bill Detail** - Lihat split breakdown per item
✅ **Edit Item Participants** - Checkbox selection per item
✅ **Show Assigned Tags** - Display siapa aja yang bayar item
✅ **Real-time Calculation** - Backend auto-calculate total per person
✅ **Edit Participants** - Bisa ubah siapa yang bayar kapan saja
✅ **Visual Feedback** - Tags, icons, dan color coding

## Edge Cases Handled

1. **Assigned_to Kosong**
   - Jika user tidak assign siapa-siapa → otomatis dibagi ke semua
   - Backend handle dengan default split ke semua participants

2. **Remove Participant yang sudah di-assign**
   - Backend auto-remove participant dari semua items' assigned_to
   - Automatic recalculation

3. **Tax & Service Charge**
   - Di-split berdasarkan per_item split
   - Setiap tax/service charge bagian dari total

## Testing Checklist

- [ ] Add item tanpa assign participant
- [ ] Edit item untuk assign participant
- [ ] Toggle participant on/off
- [ ] Save changes
- [ ] Verify total per person calculation
- [ ] Edit split method
- [ ] Remove participant dan verify recalculation
- [ ] Add tax/service charge dan verify split

## Future Enhancements

- [ ] Bulk assign multiple items
- [ ] Template save/recall untuk frequent splits
- [ ] Percentage-based split per item
- [ ] Custom amount per item per person
- [ ] Split dispute resolution
- [ ] Itemized receipt split

---

**Last Updated:** March 3, 2026
**Version:** 1.0 - Beta
