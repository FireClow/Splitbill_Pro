"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BalanceCard } from "@/components/BalanceCard";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/hooks/useI18n";

const groups = [
  { id: "grp-1", name: "Dinner Friday", members: 4, unsettled: 125000 },
  { id: "grp-2", name: "Trip Bali", members: 6, unsettled: 860000 },
];

export default function DashboardPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 320);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="page-enter mx-auto min-h-screen w-full max-w-md px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">{t("dashboard.title")}</h1>
          <p className="mt-2 text-sm leading-5 text-slate-400">{t("dashboard.subtitle")}</p>
        </div>
        <LanguageToggle />
      </header>

      {loading ? (
        <section className="space-y-3">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </section>
      ) : groups.length === 0 ? (
        <section className="surface-card p-5 text-center">
          <p className="text-sm text-slate-300">Belum ada grup aktif.</p>
          <p className="mt-1 text-xs text-slate-500">Bikin grup dulu biar pembagian tagihan lebih rapi.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {groups.map((group, idx) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="surface-card block animate-rise p-4 transition hover:border-white/20 active:scale-[0.99]"
              style={{ animationDelay: `${idx * 70}ms` }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{group.name}</h2>
                <span className="rounded-full border border-[#4a7cff]/40 bg-[#4a7cff]/12 px-3 py-1 text-xs font-semibold text-[#bcd0ff]">
                  {group.members} orang
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-400">Outstanding Rp {group.unsettled.toLocaleString("id-ID")}</p>
            </Link>
          ))}
        </section>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3">
        <BalanceCard name="Rani" amount={25000} />
        <BalanceCard name="Adi" amount={-40000} />
      </section>

      <Link
        href="/expenses/new"
        className="mt-6 block rounded-2xl bg-[#4a7cff] px-4 py-3 text-center font-semibold text-white transition active:scale-[0.98]"
      >
        + Expense
      </Link>
    </main>
  );
}
