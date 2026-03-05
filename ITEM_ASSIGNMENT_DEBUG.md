# Item Assignment UI - Debug Guide

## Issue
The Item Assignment UI component is not appearing when "Split by Item" is selected.

## Debug Steps

### 1. Open Browser Developer Console
Press `F12` or  `Ctrl+Shift+I` to open DevTools and go to the **Console** tab.

### 2. Create a Test Bill
Go through Steps 1-4 to create a bill:
- **Step 1**: Add bill details (amount, date, currency)
- **Step 2**: Add 2-3 items with quantities/prices
- **Step 3**: Add 2+ participants  
- **Step 4**: Confirm participants

### 3. Reach Step 5 (Split Method Selection)
You should see the "How to Split?" screen with 4 methods:
- ➗ Equal Split
- 🍽️ Split by Item
- 📊 Percentage Split
- 💰 Custom Amount

### 4. Click on "Split by Item" Card
- Click the card header "Split by Item"
- The card should expand showing:
  - Description: "Assign items to participants. Cost is split based on who ordered what."
  - Button: "Select Item Split"

**Expected Console Logs:**
```
🔀 [Step5] Render check - itemAssignmentMode: false form.splitMethod: ITEM
🎯 [Step5] Should show ItemAssignmentUI? false
```

### 5. Click "Select Item Split" Button
This is the critical step. Click the "Select Item Split" button.

**Expected Console Logs:**
```
🔀 [Step5] SELECT ITEM SPLIT BUTTON PRESSED!
🔀 [Step5] About to call handleSelectMethod with ITEM
🔀 [Step5] Split method selected: ITEM
📊 [Step5] BEFORE setSplitMethod - form.splitMethod: {previous value}
🎯 [Step5] BEFORE setItemAssignmentMode - itemAssignmentMode: false
🔀 [Step5] ITEM split selected, showing assignment UI
🔀 [Step5] About to setItemAssignmentMode(true)
🎯 [Step5] Render check - itemAssignmentMode: true form.splitMethod: ITEM
🎯 [Step5] Should show ItemAssignmentUI? true
✅ [Step5] RENDERING ItemAssignmentUI!
📋 [ItemAssignmentUI] Component rendered!
📋 [ItemAssignmentUI] Form items: [array of items]
📋 [ItemAssignmentUI] Form participants: [array of participants]
```

### What Should Appear
**If everything works**, you should see the Item Assignment UI with:
- Header: "How to Split?" → Sub-header: "Assign Items"
- List of items with ✓ boxes to assign
- Participant checkboxes for each item
- "Back" button to return to method selection
- "Next" button to continue (enabled only when all items assigned)

### Troubleshooting

#### If ItemAssignmentUI Still Doesn't Appear:

**Check 1**: Are you seeing the button press logs?
- If NOT: The button click may not be registered
  - Try clicking the button again
  - Check that the button is not hidden/overlapped

**Check 2**: Are you seeing the console logs?
- If NOT: There might be a console/logging issue
  - Try all the logs in sequence

**Check 3**: Is `form.splitMethod` changing to 'ITEM'?
- Check: "form.splitMethod: ITEM" appears in logs
- If NOT: The context setSplitMethod may not be working
  - Check SplitBillContext.tsx for issues

**Check 4**: Is `itemAssignmentMode` changing to true?
- Check: "itemAssignmentMode: true" appears in logs  
- If NOT: React state update may be failing

**Check 5**: Are both conditions true?
- Check: "Should show ItemAssignmentUI? true" appears
- If NOT: One of the conditions is false

#### If ItemAssignmentUI Appears but is Empty:
- Check logs for: `Form items: []`
- This means no items in the bill
- Go back to Step 2 and add items

#### If ItemAssignmentUI Has Errors:
- Check browser console for error messages
- Screenshot the error and share

## Expected Form Structure

Your bill should have:
```typescript
{
  items: [
    { id: "item1", name: "Pizza", price: 20, quantity: 1, assignedTo: [] },
    { id: "item2", name: "Drink", price: 5, quantity: 2, assignedTo: [] }
  ],
  participants: [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bob" }
  ],
  splitMethod: "ITEM",  // Should be set after clicking button
  grandTotal: 30
}
```

## Console Output Reference

| Log | Meaning |
|-----|---------|
| 🔀 [Step5] | Split method logic |
| 📊 [Step5] | State before update |
| 🎯 [Step5] | Conditional render check |
| ✅ [Step5] | Component rendering confirmed |
| 📋 [ItemAssignmentUI] | Component mounted |

## Next Steps

1. **Open console** and follow steps above
2. **Share console output** if UI still doesn't appear
3. **Check form data** - make sure items exist
4. **Test EQUAL split first** - verify flow works for other methods

## Files Modified with Debug Logging

1. `frontend/app/create-bill-flow/create-bill-step5.tsx`
   - Added detailed logging in `handleSelectMethod`
   - Added render check logs before conditional return
   - Added button press logs

2. `frontend/app/create-bill-flow/ItemAssignmentUI.tsx`
   - Added component render confirmation
   - Added form data logging

These logs will help identify exactly where the flow is breaking.
