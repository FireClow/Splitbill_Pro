import Link from "next/link";
import { ExpenseForm } from "@/components/ExpenseForm";

const members = [
  { id: "m1", name: "Rani" },
  { id: "m2", name: "Adi" },
  { id: "m3", name: "Bimo" },
];

export default function AddExpensePage() {
  return (
    <main className="page-enter mx-auto min-h-screen w-full max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Add Expense</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-[#9fbbff] transition hover:text-white">
          Back
        </Link>
      </div>
      <ExpenseForm members={members} />
    </main>
  );
}
