export type Locale = "id" | "en";

type MessageKey =
  | "app.title"
  | "dashboard.title"
  | "dashboard.subtitle"
  | "dashboard.newGroup"
  | "group.balanceTitle"
  | "group.reminder"
  | "expense.title"
  | "expense.amount"
  | "expense.payer"
  | "expense.splitMethod"
  | "expense.participants"
  | "expense.submit";

const messages: Record<Locale, Record<MessageKey, string>> = {
  id: {
    "app.title": "Patungin",
    "dashboard.title": "Bareng-bareng bayar, tetap santai.",
    "dashboard.subtitle": "Pantau grup, tambah pengeluaran, dan kirim pengingat tanpa canggung.",
    "dashboard.newGroup": "Buat Grup",
    "group.balanceTitle": "Siapa bayar siapa",
    "group.reminder": "Eh jangan lupa ya 🙏",
    "expense.title": "Tambah Pengeluaran",
    "expense.amount": "Total Amount",
    "expense.payer": "Yang Bayar",
    "expense.splitMethod": "Metode Split",
    "expense.participants": "Peserta",
    "expense.submit": "Simpan Pengeluaran",
  },
  en: {
    "app.title": "Patungin",
    "dashboard.title": "Split costs with less awkward moments.",
    "dashboard.subtitle": "Track groups, add expenses, and send gentle reminders.",
    "dashboard.newGroup": "Create Group",
    "group.balanceTitle": "Who owes who",
    "group.reminder": "Friendly ping, do not forget 🙏",
    "expense.title": "Add Expense",
    "expense.amount": "Total Amount",
    "expense.payer": "Payer",
    "expense.splitMethod": "Split Method",
    "expense.participants": "Participants",
    "expense.submit": "Save Expense",
  },
};

export function getMessage(locale: Locale, key: MessageKey) {
  return messages[locale][key];
}
