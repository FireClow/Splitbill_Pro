"use client";

import Link from "next/link";
import { ReminderChip } from "@/components/ReminderChip";
import { useI18n } from "@/hooks/useI18n";

const simplifiedDebts = [
  { from: "Adi", to: "Rani", amount: 35000 },
  { from: "Bimo", to: "Rani", amount: 15000 },
];

export default function GroupDetailPage() {
  const { t } = useI18n();

  return (
    <main className="page-enter mx-auto min-h-screen w-full max-w-md px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">Dinner Friday</h1>
        <Link href="/dashboard" className="text-sm font-semibold text-[#9fbbff] transition hover:text-white">
          Back
        </Link>
      </div>

      <section className="surface-card p-5">
        <h2 className="mb-4 text-lg font-bold text-white">{t("group.balanceTitle")}</h2>
        <div className="space-y-3">
          {simplifiedDebts.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-[#1f1f1f] px-4 py-5 text-center text-sm text-slate-400">
              Semua sudah beres. Belum ada tagihan yang perlu dibayar.
            </p>
          ) : simplifiedDebts.map((debt) => (
            <div key={`${debt.from}-${debt.to}`} className="rounded-2xl border border-white/10 bg-[#1f1f1f] p-3">
              <p className="text-sm text-slate-200">
                <span className="font-semibold">{debt.from}</span> bayar ke <span className="font-semibold">{debt.to}</span>
              </p>
              <p className="mt-1 text-sm text-slate-400">Rp {debt.amount.toLocaleString("id-ID")}</p>
              <div className="mt-3">
                <ReminderChip text={t("group.reminder")} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <Link href="/expenses/new" className="mt-6 block rounded-2xl bg-[#4a7cff] px-4 py-3 text-center font-semibold text-white transition active:scale-[0.98]">
        + Tambah Pengeluaran
      </Link>
    </main>
  );
}
