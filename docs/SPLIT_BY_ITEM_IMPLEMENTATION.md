/* 
 * SPLIT_BY_ITEM_IMPLEMENTATION.md
 * 
 * Panduan lengkap implementasi Split Bill by Item di aplikasi
 * Covers: Create Flow, Edit Flow, Calculation, dan Edge Cases
 */

# Split Bill by Item - Implementation Guide

## 1. CREATE BILL FLOW

### Step 1: Create Bill dengan Items

**File:** `frontend/app/create-bill.tsx`

Saat user membuat bill baru dengan "Split by Item":

```tsx
const handleSave = async () => {
  // 1. Validasi input
  const validItems = items.filter(i => i.name.trim() && parseFloat(i.price) > 0);
  
  // 2. Siapkan data untuk dikirim ke backend
  const billData = {
    title: title.trim(),
    currency,
    items: validItems.map(i => ({
      name: i.name.trim(),
      price: parseFloat(i.price),
      quantity: parseInt(i.quantity) || 1,
      assigned_to: []  // ← Mulai kosong! User assign di bill detail
    })),
    participants: participants.map(p => ({
      name: p.name,
      contact_info: p.contact_info
    })),
    split_method: "per_item",  // ← Set to per_item
    tax_type: taxType,
    tax_value: parseFloat(taxValue) || 0,
    service_charge: parseFloat(serviceCharge) || 0,
  };
  
  // 3. Send ke backend
  const result = await api.createBill(billData);
  
  // 4. Redirect ke bill detail untuk assign participants per item
  router.replace(`/bill/${result.bill_id}`);
};
```

**Backend Response:**

```json
{
  "bill_id": "bill_abc123",
  "items": [
    {
      "item_id": "item_001",
      "name": "Nasi Goreng",
      "price": 10000,
      "quantity": 2,
      "assigned_to": []  // Kosong di awal
    }
  ],
  "participants": [...],
  "split_method": "per_item",
  "splits": [...]  // Dihitung berdasarkan equal jika assigned_to kosong
}
```

---

## 2. BILL DETAIL - VIEW & EDIT FLOW

### Step 2a: Display Items dengan Edit Button

**File:** `frontend/app/bill/[id].tsx`

```tsx
// Show items dengan button untuk edit participants
{bill.split_method === 'per_item' && bill.items?.map(item => (
  <View key={item.item_id} style={styles.itemRow}>
    {/* Item Info */}
    <View style={styles.itemInfo}>
      <Text style={styles.itemName}>{item.name}</Text>
      <Text style={styles.itemQty}>
        x{item.quantity} @ {bill.currency} 
        {(item.price).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </Text>
    </View>
    
    {/* Total & Actions */}
    <View style={styles.itemActions}>
      <Text style={styles.itemPrice}>
        {bill.currency} {((item.price * item.quantity) || 0).toLocaleString()}
      </Text>
      
      {/* Edit Participants Button */}
      <TouchableOpacity
        onPress={() => handleEditItemAssignedTo(item.item_id, item.assigned_to || [])}
      >
        <Ionicons name="people-outline" size={18} color={Colors.primary} />
      </TouchableOpacity>
      
      {/* Delete Button */}
      <TouchableOpacity
        onPress={() => handleDeleteItem(item.item_id)}
      >
        <Ionicons name="close-circle-outline" size={18} color={Colors.muted} />
      </TouchableOpacity>
    </View>
  </View>
))}
```

### Step 2b: Show Assigned Participants as Tags

```tsx
{/* Show siapa aja yang bayar item ini */}
{bill.split_method === 'per_item' && 
 item.assigned_to && 
 item.assigned_to.length > 0 && (
  <View style={styles.itemAssignedInfo}>
    <Text style={styles.assignedInfoLabel}>Split among:</Text>
    <View style={styles.assignedInfoTags}>
      {item.assigned_to.map((participantId: string) => {
        const participant = bill.participants.find(
          (p: any) => p.participant_id === participantId
        );
        return participant ? (
          <View key={participantId} style={styles.assignedTag}>
            <Text style={styles.assignedTagText}>
              {participant.name}
            </Text>
          </View>
        ) : null;
      })}
    </View>
  </View>
)}
```

### Step 2c: Edit Mode - Participant Selection

**Handler Functions:**

```tsx
// 1. Start editing mode
const handleEditItemAssignedTo = (itemId: string, currentAssignedTo: string[]) => {
  setEditingItemId(itemId);
  setEditingItemAssignedTo([...currentAssignedTo]);  // Deep copy
};

// 2. Toggle participant selection
const handleToggleParticipantForItem = (participantId: string) => {
  setEditingItemAssignedTo(prev =>
    prev.includes(participantId)
      ? prev.filter(id => id !== participantId)  // Uncheck
      : [...prev, participantId]                  // Check
  );
};

// 3. Save to backend
const handleSaveItemAssignedTo = async () => {
  if (!editingItemId) return;
  
  try {
    // Call API untuk update item dengan assigned_to baru
    const updated = await api.updateItem(
      billId,
      editingItemId,
      { assigned_to: editingItemAssignedTo }
    );
    
    // Update UI dengan data baru dari backend
    setBill(updated);  // Bill sudah include recalculated splits!
    
    // Reset editing state
    setEditingItemId(null);
    setEditingItemAssignedTo([]);
  } catch (err) {
    Alert.alert('Error', err.message);
  }
};
```

**UI Component:**

```tsx
{/* Edit Mode - Show checkboxes */}
{editingItemId === item.item_id && (
  <View style={styles.itemEditSection}>
    <Text style={styles.editSectionTitle}>
      Select who pays for this item:
    </Text>
    
    {bill.participants?.map((participant: any) => (
      <TouchableOpacity
        key={participant.participant_id}
        style={styles.participantCheckRow}
        onPress={() => handleToggleParticipantForItem(
          participant.participant_id
        )}
      >
        {/* Checkbox */}
        <View style={styles.checkboxContainer}>
          <View style={[
            styles.checkbox,
            editingItemAssignedTo.includes(participant.participant_id) && 
            styles.checkboxChecked
          ]}>
            {editingItemAssignedTo.includes(participant.participant_id) && (
              <Ionicons name="checkmark" size={14} color={Colors.white} />
            )}
          </View>
        </View>
        
        {/* Name */}
        <Text style={styles.participantCheckLabel}>
          {participant.name}
        </Text>
      </TouchableOpacity>
    ))}
    
    {/* Action buttons */}
    <View style={styles.editActionRow}>
      <TouchableOpacity
        style={[styles.editBtn, styles.editBtnCancel]}
        onPress={() => setEditingItemId(null)}  // Cancel without saving
      >
        <Text style={styles.editBtnText}>Cancel</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.editBtn, styles.editBtnSave]}
        onPress={handleSaveItemAssignedTo}  // Save changes
      >
        <Text style={[styles.editBtnText, { color: Colors.primaryForeground }]}>
          Save
        </Text>
      </TouchableOpacity>
    </View>
  </View>
)}
```

---

## 3. SPLIT BREAKDOWN & CALCULATION

### Step 3a: Display Split Results

Setelah user save assigned_to, backend otomatis recalculate dan return updated bill dengan splits baru.

```tsx
{/* Summary: Total Per Person */}
{bill.split_method === 'per_item' && (
  <View style={styles.splitSummarySection}>
    <Text style={styles.splitSummaryTitle}>Total Per Person</Text>
    
    {bill.splits?.map(split => (
      <TouchableOpacity
        key={split.participant_id}
        style={styles.splitCard}
        onPress={() => handleTogglePayment(split)}  // Mark as paid
      >
        <View style={styles.splitLeft}>
          <View style={[
            styles.splitAvatar,
            split.status === 'paid' && styles.splitAvatarPaid
          ]}>
            <Text style={styles.splitAvatarText}>
              {split.participant_name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          
          <View>
            <Text style={styles.splitName}>
              {split.participant_name}
            </Text>
            <Text style={[
              styles.splitStatus,
              {
                color: split.status === 'paid' ? Colors.success : Colors.warning
              }
            ]}>
              {split.status === 'paid' ? 'Paid' : 'Unpaid'}
            </Text>
          </View>
        </View>
        
        <View style={styles.splitRight}>
          <Text style={styles.splitAmount}>
            {bill.currency} {(split.amount_due || 0).toLocaleString(
              'en-US', 
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}
          </Text>
          
          {/* Payment toggle */}
          <View style={[
            styles.paymentToggle,
            split.status === 'paid' && styles.paymentTogglePaid
          ]}>
            <Ionicons
              name={split.status === 'paid' ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={split.status === 'paid' ? Colors.success : Colors.muted}
            />
          </View>
        </View>
      </TouchableOpacity>
    ))}
  </View>
)}
```

### Step 3b: Items Breakdown View

Tambahan view untuk show detail breakdown per item:

```tsx
{/* Detailed breakdown per item */}
{bill.split_method === 'per_item' && bill.items && bill.items.length > 0 && (
  <View style={styles.itemsBreakdownSection}>
    <Text style={styles.itemsBreakdownTitle}>Items Breakdown</Text>
    
    {bill.items.map(item => {
      // Cari siapa aja yang assign ke item ini
      const assignedParticipants = item.assigned_to && item.assigned_to.length > 0
        ? bill.participants.filter(p => item.assigned_to.includes(p.participant_id))
        : bill.participants;  // Jika kosong, berarti semua orang
      
      const itemTotal = item.price * item.quantity;
      const perPersonAmount = assignedParticipants.length > 0
        ? itemTotal / assignedParticipants.length
        : 0;
      
      return (
        <View key={item.item_id} style={styles.itemBreakdownCard}>
          {/* Header */}
          <View style={styles.itemBreakdownHeader}>
            <View style={styles.itemBreakdownInfo}>
              <Text style={styles.itemBreakdownName}>
                {item.name}
              </Text>
              <Text style={styles.itemBreakdownQty}>
                x{item.quantity} @ {bill.currency} {item.price.toLocaleString(
                  'en-US',
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}
              </Text>
            </View>
            <Text style={styles.itemBreakdownTotal}>
              {bill.currency} {itemTotal.toLocaleString(
                'en-US',
                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
              )}
            </Text>
          </View>
          
          {/* Who pays breakdown */}
          <View style={styles.itemAssignedTo}>
            <Text style={styles.assignedLabel}>Split among:</Text>
            {assignedParticipants.map(p => (
              <View key={p.participant_id} style={styles.assignedPersonRow}>
                <View style={styles.assignedPersonAvatar}>
                  <Text style={styles.assignedPersonAvatarText}>
                    {p.name[0].toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.assignedPersonName}>
                  {p.name}
                </Text>
                <Text style={styles.assignedPersonAmount}>
                  {bill.currency} {perPersonAmount.toLocaleString(
                    'en-US',
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                  )}
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
    })}
  </View>
)}
```

---

## 4. API INTEGRATION

### Update Item with Assigned_to

```typescript
// frontend/utils/api.ts

updateItem: (billId: string, itemId: string, data: Record<string, any>) =>
  apiFetch(`/bills/${billId}/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
```

**Usage:**

```tsx
const response = await api.updateItem(billId, itemId, {
  assigned_to: ["part_123", "part_456"]
});

// Response includes recalculated splits:
{
  "items": [
    {
      "item_id": "item_001",
      "name": "Nasi Goreng",
      "assigned_to": ["part_123", "part_456"],
      ...
    }
  ],
  "splits": [
    {
      "participant_id": "part_123",
      "amount_due": 100000,
      ...
    },
    ...
  ],
  ...
}
```

---

## 5. EDGE CASES & HANDLING

### Case 1: Assigned_to Kosong (Semua orang bayar)

```tsx
// Di frontend, jika assigned_to = []
const assignedParticipants = item.assigned_to && item.assigned_to.length > 0
  ? bill.participants.filter(p => item.assigned_to.includes(p.participant_id))
  : bill.participants;  // Default: semua orang

// Backend juga handle ini di calculate_splits()
if assigned == []:
    share = item_total / len(participants)  # Dibagi semua
else:
    share = item_total / len(assigned)      # Dibagi yang dipilih
```

### Case 2: Participant Dihapus dari Bill

```tsx
// Backend otomatis remove dari assigned_to semua items
@api_router.delete("/bills/{bill_id}/participants/{participant_id}")
async def remove_participant(...):
    bill["participants"] = [...]
    
    # Remove participant dari assigned_to di semua items
    for item in bill["items"]:
        item["assigned_to"] = [
            pid for pid in item.get("assigned_to", [])
            if pid != participant_id
        ]
    
    # Recalculate splits
    splits = calculate_splits(bill, bill.get("split_method", "equal"))
    ...
```

### Case 3: Tax & Service Charge Distribution

Backend handle distribusi tax berdasarkan per_item split:

```python
# Setelah calculate item splits, tambah tax & service

if method == "per_item":
    # Hitung persentase setiap orang dari total (untuk tax)
    subtotal_map = {p_id: amount for p_id, amount in participant_totals}
    
    for p_id in participant_totals:
        proportion = subtotal_map[p_id] / bill_subtotal  # Persentase
        participant_totals[p_id] += bill_tax_amount * proportion
        participant_totals[p_id] += bill_service_charge * proportion
```

---

## 6. STATE MANAGEMENT

### Bill Detail Component State

```tsx
// Untuk tracking editing
const [editingItemId, setEditingItemId] = useState<string | null>(null);
const [editingItemAssignedTo, setEditingItemAssignedTo] = useState<string[]>([]);

// Untuk bill data
const [bill, setBill] = useState<any>(null);
```

### Flow:

1. User klik "people" icon → `handleEditItemAssignedTo()` → state berubah
2. User toggle checkbox → `handleToggleParticipantForItem()` → array berubah
3. User klik "Save" → `handleSaveItemAssignedTo()` → API call
4. API return updated bill → `setBill(updated)` → UI refresh
5. State reset → User bisa edit item lain

---

## 7. TESTING CHECKLIST

```tsx
// Test file location: frontend/tests/split-by-item.test.ts

describe('Split by Item Feature', () => {
  
  // UI Tests
  test('Show edit button when split_method is per_item')
  test('Click edit button shows checkbox modal')
  test('Toggle checkbox updates editingItemAssignedTo state')
  test('Click save calls API with correct data')
  
  // Calculation Tests
  test('Calculate correct share when assigned to subset')
  test('Calculate correct share when assigned_to is empty')
  test('Recalculate when participant removed')
  
  // Integration Tests
  test('Create bill → No assignment → Edit & assign → Verify totals')
  test('Edit multiple items → Verify total per person')
  test('Remove participant → Verify updated amounts')
});
```

---

## 8. UI/UX BEST PRACTICES

✅ **Show current assignment with tags**
✅ **Clear "Edit" button that's easy to find**
✅ **Checkbox untuk easy multi-select**
✅ **Cancel button untuk undo tanpa save**
✅ **Real-time total update after save**
✅ **Show breakdown per item & per person**
✅ **Clear feedback setelah save (toast atau similar)**

---

**Version:** 1.0
**Last Updated:** March 3, 2026
