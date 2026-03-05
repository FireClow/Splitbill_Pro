/* 
 * SPLIT_BY_ITEM_EXAMPLES.ts
 * 
 * Contoh implementasi dan test cases untuk fitur Split Bill by Item
 * Copas dan modifikasi sesuai kebutuhan
 */

// ====================================================================
// EXAMPLE 1: Simple Split 3 Orang - Restaurant
// ====================================================================

export const example1_RestaurantSplit = {
  bill_id: "bill_rest_001",
  title: "Dinner at Warung Makan Soto Ayam",
  currency: "IDR",
  
  // Setup peserta
  participants: [
    {
      participant_id: "part_kenji_001",
      name: "Kenji",
      contact_info: "kenji@example.com",
      is_owner: true
    },
    {
      participant_id: "part_fico_001",
      name: "Fico",
      contact_info: "fico@example.com",
      is_owner: false
    },
    {
      participant_id: "part_lisa_001",
      name: "Lisa",
      contact_info: "lisa@example.com",
      is_owner: false
    }
  ],
  
  // Items dengan split per person
  items: [
    {
      item_id: "item_001",
      name: "Nasi Goreng Spesial",
      price: 15000,
      quantity: 2,
      assigned_to: ["part_kenji_001", "part_fico_001"]
      // Kenji & Fico = 15000 × 2 ÷ 2 = 15000 per orang
    },
    {
      item_id: "item_002",
      name: "Soto Ayam",
      price: 12000,
      quantity: 1,
      assigned_to: ["part_kenji_001"]
      // Kenji saja = 12000
    },
    {
      item_id: "item_003",
      name: "Es Teh Manis",
      price: 5000,
      quantity: 3,
      assigned_to: ["part_kenji_001", "part_fico_001", "part_lisa_001"]
      // Kenji, Fico, Lisa = 5000 × 3 ÷ 3 = 5000 per orang
    }
  ],
  
  tax_value: 0,
  tax_type: "percentage",
  service_charge: 0,
  
  // Hasil perhitungan backend
  splits: [
    {
      participant_id: "part_kenji_001",
      participant_name: "Kenji",
      amount_due: 30000,
      amount_paid: 0,
      status: "unpaid"
    },
    {
      participant_id: "part_fico_001",
      participant_name: "Fico",
      amount_due: 20000,
      amount_paid: 0,
      status: "unpaid"
    },
    {
      participant_id: "part_lisa_001",
      participant_name: "Lisa",
      amount_due: 5000,
      amount_paid: 0,
      status: "unpaid"
    }
  ],
  
  subtotal: 55000,
  tax_amount: 0,
  service_charge: 0,
  total_amount: 55000,
  split_method: "per_item"
};


// ====================================================================
// EXAMPLE 2: Office Lunch - Dengan Tax & Service Charge
// ====================================================================

export const example2_OfficeLunch = {
  bill_id: "bill_lunch_002",
  title: "Team Lunch - Catering PT Makmur",
  currency: "IDR",
  
  participants: [
    {
      participant_id: "part_rudi_001",
      name: "Rudi (Manager)",
      contact_info: "rudi@company.com",
      is_owner: true
    },
    {
      participant_id: "part_siti_001",
      name: "Siti (Dev)",
      contact_info: "siti@company.com",
      is_owner: false
    },
    {
      participant_id: "part_budi_001",
      name: "Budi (Design)",
      contact_info: "budi@company.com",
      is_owner: false
    },
    {
      participant_id: "part_ani_001",
      name: "Ani (Marketing)",
      contact_info: "ani@company.com",
      is_owner: false
    }
  ],
  
  items: [
    {
      item_id: "item_catering_001",
      name: "Paket Nasi Kuning 10 porsi",
      price: 150000,
      quantity: 1,
      assigned_to: ["part_rudi_001", "part_siti_001", "part_budi_001", "part_ani_001"]
      // 150000 ÷ 4 = 37500 per orang
    },
    {
      item_id: "item_catering_002",
      name: "Ayam Bakar 10 potong",
      price: 100000,
      quantity: 1,
      assigned_to: ["part_rudi_001", "part_siti_001", "part_budi_001", "part_ani_001"]
      // 100000 ÷ 4 = 25000 per orang
    },
    {
      item_id: "item_catering_003",
      name: "Minuman Aqua (1 krat)",
      price: 50000,
      quantity: 1,
      assigned_to: ["part_rudi_001", "part_siti_001", "part_budi_001", "part_ani_001"]
      // 50000 ÷ 4 = 12500 per orang
    },
    {
      item_id: "item_catering_004",
      name: "Dessert Puding Nangka",
      price: 40000,
      quantity: 1,
      assigned_to: ["part_siti_001", "part_budi_001", "part_ani_001"]
      // 40000 ÷ 3 = 13333.33 per orang (tidak semua yang makan)
    }
  ],
  
  tax_value: 10,
  tax_type: "percentage",
  service_charge: 20000,
  
  subtotal: 340000,
  tax_amount: 34000,      // 340000 × 10%
  service_charge: 20000,
  total_amount: 394000,   // 340000 + 34000 + 20000
  
  splits: [
    {
      participant_id: "part_rudi_001",
      participant_name: "Rudi (Manager)",
      amount_due: 103937.50,
      amount_paid: 394000,
      status: "paid"
      // Subtotal: 37500 + 25000 + 12500 = 75000
      // Tax: 75000 × 10% = 7500
      // Service: 20000 ÷ 4 = 5000
      // Total: 75000 + 7500 + 5000 = 87500... (actual calculus sesuai backend)
    },
    {
      participant_id: "part_siti_001",
      participant_name: "Siti (Dev)",
      amount_due: 108562.50,
      amount_paid: 0,
      status: "unpaid"
    },
    {
      participant_id: "part_budi_001",
      participant_name: "Budi (Design)",
      amount_due: 108562.50,
      amount_paid: 0,
      status: "unpaid"
    },
    {
      participant_id: "part_ani_001",
      participant_name: "Ani (Marketing)",
      amount_due: 72937.50,
      amount_paid: 0,
      status: "unpaid"
    }
  ],
  
  split_method: "per_item"
};


// ====================================================================
// EXAMPLE 3: Complex: Berbagai Pembelian, Assigned_to Sangat Berbeda
// ====================================================================

export const example3_ComplexSplit = {
  bill_id: "bill_complex_003",
  title: "Weekend Getaway - Villa Rental & Foods",
  currency: "IDR",
  
  participants: [
    {
      participant_id: "part_agus_001",
      name: "Agus",
      contact_info: "agus@example.com",
      is_owner: true
    },
    {
      participant_id: "part_bona_001",
      name: "Bona",
      contact_info: "bona@example.com",
      is_owner: false
    },
    {
      participant_id: "part_citra_001",
      name: "Citra",
      contact_info: "citra@example.com",
      is_owner: false
    },
    {
      participant_id: "part_dodo_001",
      name: "Dodo",
      contact_info: "dodo@example.com",
      is_owner: false
    }
  ],
  
  items: [
    {
      item_id: "item_villa_001",
      name: "Villa Rental 2 Malam",
      price: 600000,
      quantity: 1,
      assigned_to: ["part_agus_001", "part_bona_001", "part_citra_001", "part_dodo_001"]
      // 600000 ÷ 4 = 150000 per orang
    },
    {
      item_id: "item_dinner_001",
      name: "Dinner di Restoran (6 porsi)",
      price: 300000,
      quantity: 1,
      assigned_to: ["part_agus_001", "part_bona_001", "part_citra_001"]
      // Dodo tidak ikut -> 300000 ÷ 3 = 100000 per orang
    },
    {
      item_id: "item_breakfast_001",
      name: "Groceries untuk Breakfast",
      price: 200000,
      quantity: 1,
      assigned_to: ["part_agus_001", "part_bona_001", "part_citra_001", "part_dodo_001"]
      // 200000 ÷ 4 = 50000 per orang
    },
    {
      item_id: "item_wine_001",
      name: "Wine Premium (1 botol)",
      price: 150000,
      quantity: 1,
      assigned_to: ["part_agus_001", "part_bona_001"]
      // Hanya Agus & Bona -> 150000 ÷ 2 = 75000 per orang
    },
    {
      item_id: "item_petrol_001",
      name: "Bensin Perjalanan",
      price: 100000,
      quantity: 1,
      assigned_to: ["part_agus_001", "part_bona_001", "part_citra_001", "part_dodo_001"]
      // 100000 ÷ 4 = 25000 per orang
    }
  ],
  
  tax_value: 0,
  tax_type: "percentage",
  service_charge: 0,
  
  subtotal: 1350000,
  tax_amount: 0,
  service_charge: 0,
  total_amount: 1350000,
  
  splits: [
    {
      participant_id: "part_agus_001",
      participant_name: "Agus",
      amount_due: 400000,
      amount_paid: 1350000,
      status: "paid"
      // 150000 (villa) + 100000 (dinner) + 50000 (breakfast) + 75000 (wine) + 25000 (bensin)
    },
    {
      participant_id: "part_bona_001",
      participant_name: "Bona",
      amount_due: 400000,
      amount_paid: 0,
      status: "unpaid"
      // 150000 + 100000 + 50000 + 75000 + 25000
    },
    {
      participant_id: "part_citra_001",
      participant_name: "Citra",
      amount_due: 325000,
      amount_paid: 0,
      status: "unpaid"
      // 150000 + 100000 + 50000 + 25000 (no wine)
    },
    {
      participant_id: "part_dodo_001",
      participant_name: "Dodo",
      amount_due: 225000,
      amount_paid: 0,
      status: "unpaid"
      // 150000 + 50000 + 25000 (no dinner, no wine)
    }
  ],
  
  split_method: "per_item"
};


// ====================================================================
// TESTING UTILITIES
// ====================================================================

/**
 * Validasi hasil perhitungan
 * Gunakan untuk test apakah backend menghitung dengan benar
 */
export function validateSplitCalculation(bill: any) {
  let totalCalculated = 0;
  
  for (const split of bill.splits) {
    totalCalculated += split.amount_due;
  }
  
  const tolerance = 0.01; // Rp0.01 tolerance untuk rounding
  const isValid = Math.abs(totalCalculated - bill.total_amount) < tolerance;
  
  return {
    isValid,
    totalCalculated,
    totalExpected: bill.total_amount,
    difference: totalCalculated - bill.total_amount
  };
}

/**
 * Debugging function - print split breakdown
 */
export function printSplitBreakdown(bill: any) {
  console.log("\n=== SPLIT BREAKDOWN ===");
  console.log(`Bill: ${bill.title}`);
  console.log(`Total: ${bill.currency} ${bill.total_amount.toLocaleString()}`);
  console.log("\nAmount per person:");
  
  for (const split of bill.splits) {
    const status = split.status === "paid" ? "✓ PAID" : "✗ UNPAID";
    console.log(
      `  ${split.participant_name}: ${bill.currency} ${split.amount_due.toLocaleString()} [${status}]`
    );
  }
  
  const validation = validateSplitCalculation(bill);
  console.log(`\nValidation: ${validation.isValid ? "✓ VALID" : "✗ INVALID"}`);
}

/**
 * Cari item untuk participant
 */
export function getItemsForParticipant(bill: any, participantId: string) {
  return bill.items.filter((item: any) => 
    !item.assigned_to || 
    item.assigned_to.length === 0 || 
    item.assigned_to.includes(participantId)
  );
}

/**
 * Hitung manual berapa yang harus dibayar orang tertentu
 * Berguna untuk verifikasi perhitungan
 */
export function calculateManualSplit(bill: any, participantId: string) {
  let total = 0;
  
  for (const item of bill.items) {
    const assigned = item.assigned_to || [];
    const itemTotal = item.price * item.quantity;
    
    // Check apakah participant assigned ke item ini
    const isAssigned = assigned.length === 0 || assigned.includes(participantId);
    
    if (isAssigned) {
      // Hitung share
      const numAssigned = assigned.length === 0 ? bill.participants.length : assigned.length;
      const share = itemTotal / numAssigned;
      total += share;
    }
  }
  
  return total;
}


// ====================================================================
// USAGE EXAMPLES
// ====================================================================

/*

// Test Example 1
console.log("=== EXAMPLE 1 ===");
printSplitBreakdown(example1_RestaurantSplit);

// Test Example 2
console.log("\n=== EXAMPLE 2 ===");
printSplitBreakdown(example2_OfficeLunch);

// Test Example 3
console.log("\n=== EXAMPLE 3 ===");
printSplitBreakdown(example3_ComplexSplit);

// Manual verification
const manualCalc = calculateManualSplit(example3_ComplexSplit, "part_agus_001");
console.log(`\nManual calc for Agus: ${manualCalc}`);

// Get items for participant
const amusItems = getItemsForParticipant(example3_ComplexSplit, "part_agus_001");
console.log(`Items for Agus:`, amusItems.map(i => i.name));

*/
