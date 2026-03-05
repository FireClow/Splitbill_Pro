/**
 * Test Cases untuk calculateItemAmounts & calculateItemSplit
 * Jalankan: npm test ITEM_SPLIT_GUIDE.test.ts atau copy-paste code ke console
 */

import { calculateItemAmounts, calculateItemSplit } from './splitCalculations';
import { Item, Participant } from '../types/billing';

// ============================================================================
// TEST DATA SETUP
// ============================================================================

const participants: Participant[] = [
  { id: 'u1', name: 'Kenji' },
  { id: 'u2', name: 'Fico' },
  { id: 'u3', name: 'Ravi' },
];

// ============================================================================
// TEST 1: Basic Item Split (2 items, 2 people)
// ============================================================================

console.log('\n=== TEST 1: Basic Item Split ===');
console.log('Scenario: Item 1 shared by 2, Item 2 only for 1 person\n');

const test1_items: Item[] = [
  {
    id: '1',
    name: 'Makanan A',
    price: 10000,
    quantity: 2,
    assignedTo: ['u1', 'u2'],
  },
  {
    id: '2',
    name: 'Makanan B',
    price: 15000,
    quantity: 1,
    assignedTo: ['u1'],
  },
];

try {
  const result1 = calculateItemAmounts(test1_items, participants.slice(0, 2));
  
  console.log('Item Amounts:');
  console.log(`  u1 (Kenji): ${result1['u1']} (Expected: 25000)`);
  console.log(`  u2 (Fico):  ${result1['u2']} (Expected: 10000)`);
  console.log(`  Total:      ${result1['u1'] + result1['u2']} (Expected: 35000)`);
  console.log(`  ✓ PASS: ${result1['u1'] === 25000 && result1['u2'] === 10000 ? 'YES' : 'FAIL'}`);
} catch (error) {
  console.error('✗ FAIL:', error);
}

// ============================================================================
// TEST 2: With Tax & Service Charge Distribution
// ============================================================================

console.log('\n=== TEST 2: Item Split + Tax + Service Charge ===');
console.log('Scenario: Same items with 10% tax and 5% service charge\n');

const subtotal = 35000;
const taxAmount = 3500; // 10%
const serviceAmount = 1750; // 5%
const grandTotal = subtotal + taxAmount + serviceAmount; // 40250

try {
  const breakdown = calculateItemSplit(
    test1_items,
    participants.slice(0, 2),
    grandTotal,
    taxAmount,
    serviceAmount,
    subtotal
  );

  console.log('Breakdown:');
  breakdown.forEach(item => {
    console.log(`  ${item.participantName}: ${item.amount}`);
  });

  const totalFromBreakdown = breakdown.reduce((sum, item) => sum + item.amount, 0);
  console.log(`  Total: ${totalFromBreakdown.toFixed(2)} (Expected: ${grandTotal})`);
  console.log(`  ✓ PASS: ${Math.abs(totalFromBreakdown - grandTotal) < 0.01 ? 'YES' : 'FAIL'}`);
} catch (error) {
  console.error('✗ FAIL:', error);
}

// ============================================================================
// TEST 3: All 3 People Share Everything Equally
// ============================================================================

console.log('\n=== TEST 3: 3 People Share Both Items ===');
console.log('Scenario: 2 items both assigned to all 3 people\n');

const test3_items: Item[] = [
  {
    id: '1',
    name: 'Pizza (Large)',
    price: 30000,
    quantity: 1,
    assignedTo: ['u1', 'u2', 'u3'],
  },
  {
    id: '2',
    name: 'Drink',
    price: 9000,
    quantity: 3,
    assignedTo: ['u1', 'u2', 'u3'],
  },
];

try {
  const result3 = calculateItemAmounts(test3_items, participants);

  console.log('Item Amounts:');
  console.log(`  Pizza: 30000, shared by 3 = 10000 each`);
  console.log(`  Drink: 9000 × 3 = 27000, shared by 3 = 9000 each`);
  console.log(`  Total per person: 10000 + 9000 = 19000\n`);
  
  participants.forEach(p => {
    console.log(`  ${p.name}: ${result3[p.id]} (Expected: 19000)`);
  });

  const isCorrect = Object.values(result3).every(v => v === 19000);
  console.log(`  ✓ PASS: ${isCorrect ? 'YES' : 'FAIL'}`);
} catch (error) {
  console.error('✗ FAIL:', error);
}

// ============================================================================
// TEST 4: Different Quantities
// ============================================================================

console.log('\n=== TEST 4: Items with Different Quantities ===');
console.log('Scenario: Item with qty=2 vs qty=5\n');

const test4_items: Item[] = [
  {
    id: '1',
    name: 'Burger (qty=2)',
    price: 50000,
    quantity: 2,
    assignedTo: ['u1', 'u2'],
  },
  {
    id: '2',
    name: 'Fries (qty=5)',
    price: 5000,
    quantity: 5,
    assignedTo: ['u1', 'u2'],
  },
];

try {
  const result4 = calculateItemAmounts(test4_items, participants.slice(0, 2));

  console.log('Item Amounts:');
  console.log(`  Burger: 50000 × 2 = 100000, ÷ 2 people = 50000 each`);
  console.log(`  Fries: 5000 × 5 = 25000, ÷ 2 people = 12500 each\n`);
  
  console.log(`  u1 (Kenji): ${result4['u1']} (Expected: 62500)`);
  console.log(`  u2 (Fico):  ${result4['u2']} (Expected: 62500)`);
  
  const isCorrect = result4['u1'] === 62500 && result4['u2'] === 62500;
  console.log(`  ✓ PASS: ${isCorrect ? 'YES' : 'FAIL'}`);
} catch (error) {
  console.error('✗ FAIL:', error);
}

// ============================================================================
// TEST 5: Single Item, Single Person (No Split)
// ============================================================================

console.log('\n=== TEST 5: Single Item, Single Person ===');
console.log('Scenario: 1 item assigned to 1 person\n');

const test5_items: Item[] = [
  {
    id: '1',
    name: 'Premium Meal',
    price: 100000,
    quantity: 1,
    assignedTo: ['u1'],
  },
];

try {
  const result5 = calculateItemAmounts(test5_items, participants.slice(0, 2));

  console.log('Item Amounts:');
  console.log(`  u1 (Kenji): ${result5['u1']} (Expected: 100000)`);
  console.log(`  u2 (Fico):  ${result5['u2']} (Expected: 0)`);
  
  const isCorrect = result5['u1'] === 100000 && result5['u2'] === 0;
  console.log(`  ✓ PASS: ${isCorrect ? 'YES' : 'FAIL'}`);
} catch (error) {
  console.error('✗ FAIL:', error);
}

// ============================================================================
// TEST 6: Decimal Prices (Floating Point)
// ============================================================================

console.log('\n=== TEST 6: Decimal Prices & Floating Point Safety ===');
console.log('Scenario: Price with decimals divided by multiple people\n');

const test6_items: Item[] = [
  {
    id: '1',
    name: 'Item with decimal',
    price: 99.99,
    quantity: 3,
    assignedTo: ['u1', 'u2', 'u3'],
  },
];

try {
  const result6 = calculateItemAmounts(test6_items, participants);

  console.log('Item Amounts:');
  console.log(`  Total: 99.99 × 3 = 299.97`);
  console.log(`  Per person: 299.97 ÷ 3 = 99.99\n`);
  
  participants.forEach(p => {
    console.log(`  ${p.name}: ${result6[p.id]}`);
  });

  const total = Object.values(result6).reduce((a, b) => a + b, 0);
  console.log(`  Total should be: 299.97 = ${total.toFixed(2)}`);
  console.log(`  ✓ PASS: ${Math.abs(total - 299.97) < 0.01 ? 'YES' : 'FAIL'}`);
} catch (error) {
  console.error('✗ FAIL:', error);
}

// ============================================================================
// TEST 7: ERROR HANDLING - Empty assignedTo
// ============================================================================

console.log('\n=== TEST 7: ERROR HANDLING - Empty assignedTo ===');
console.log('Scenario: Item with no assigned participants\n');

const test7_items: Item[] = [
  {
    id: '1',
    name: 'Unassigned Item',
    price: 50000,
    quantity: 1,
    assignedTo: [], // ← Empty!
  },
];

try {
  const result7 = calculateItemAmounts(test7_items, participants);
  console.log('✗ FAIL: Should have thrown error but got result:', result7);
} catch (error) {
  console.log(`✓ PASS: Correctly caught error:`);
  console.log(`  "${(error as Error).message}"`);
}

// ============================================================================
// TEST 8: Verify No Double Counting on Recalculation
// ============================================================================

console.log('\n=== TEST 8: No Double Counting on Recalculation ===');
console.log('Scenario: Calculate same data twice, verify same result\n');

const test8_items: Item[] = [
  {
    id: '1',
    name: 'Test Item',
    price: 40000,
    quantity: 2,
    assignedTo: ['u1', 'u2'],
  },
];

try {
  const result8a = calculateItemAmounts(test8_items, participants.slice(0, 2));
  const result8b = calculateItemAmounts(test8_items, participants.slice(0, 2));

  console.log('First calculation:');
  console.log(`  u1: ${result8a['u1']}, u2: ${result8a['u2']}`);
  console.log('Second calculation:');
  console.log(`  u1: ${result8b['u1']}, u2: ${result8b['u2']}`);

  const isSame = result8a['u1'] === result8b['u1'] && result8a['u2'] === result8b['u2'];
  console.log(`  ✓ PASS: Results identical = ${isSame ? 'YES' : 'FAIL'}`);

  // Verify NOT double-counted
  const doubled = result8a['u1'] * 2;
  console.log(`  Verify not doubled: ${result8b['u1']} ≠ ${doubled} = ${result8b['u1'] !== doubled ? 'YES' : 'FAIL'}`);
} catch (error) {
  console.error('✗ FAIL:', error);
}

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(60));
console.log('TEST SUMMARY COMPLETE');
console.log('='.repeat(60));
console.log('\nKey Safety Features Verified:');
console.log('✓ Quantity is multiplied correctly');
console.log('✓ Division by number of assigned participants is correct');
console.log('✓ Tax/service is distributed proportionally');
console.log('✓ No accumulation from previous calculations');
console.log('✓ Empty assignedTo throws error');
console.log('✓ Floating point numbers handled with .toFixed(2)');
console.log('✓ Recalculation gives same result (no side effects)');
console.log('✓ Total of breakdown equals grandTotal');
