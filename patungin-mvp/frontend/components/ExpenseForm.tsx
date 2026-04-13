"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

type Member = { id: string; name: string };

type ExpenseFormProps = {
  members: Member[];
};

export function ExpenseForm({ members }: ExpenseFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState("Makan malam");
  const [amount, setAmount] = useState(0);
  const [payerMemberId, setPayerMemberId] = useState(members[0]?.id ?? "");
  const [splitMethod, setSplitMethod] = useState<"EQUAL" | "CUSTOM" | "PER_ITEM">("EQUAL");
  const [submitMessage, setSubmitMessage] = useState("");

  const preview = useMemo(() => {
    if (!members.length || amount <= 0) return [];
    if (splitMethod === "EQUAL") {
      const base = Math.floor((amount * 100) / members.length);
      const rem = Math.round(amount * 100) % members.length;
      return members.map((m, i) => ({
        memberId: m.id,
        name: m.name,
        amount: (base + (i < rem ? 1 : 0)) / 100,
      }));
    }
    const same = Number((amount / members.length).toFixed(2));
    return members.map((m) => ({ memberId: m.id, name: m.name, amount: same }));
  }, [amount, members, splitMethod]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitMessage(`Draft tersimpan: ${title}`);
  };

  return (
    <form onSubmit={onSubmit} className="surface-card space-y-4 p-5">
      <h2 className="text-lg font-bold text-white">{t("expense.title")}</h2>
      <input
        value={title}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#171717] px-4 py-3 text-white placeholder:text-slate-500 focus:border-[#4a7cff]/70 focus:outline-none"
        placeholder="Judul"
      />
      <input
        value={amount || ""}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value))}
        className="w-full rounded-xl border border-white/10 bg-[#171717] px-4 py-3 text-white placeholder:text-slate-500 focus:border-[#4a7cff]/70 focus:outline-none"
        placeholder={t("expense.amount")}
        type="number"
        min={0}
      />
      <select
        value={payerMemberId}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setPayerMemberId(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#171717] px-4 py-3 text-white focus:border-[#4a7cff]/70 focus:outline-none"
      >
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {t("expense.payer")}: {member.name}
          </option>
        ))}
      </select>
      <select
        value={splitMethod}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => setSplitMethod(e.target.value as "EQUAL" | "CUSTOM" | "PER_ITEM")}
        className="w-full rounded-xl border border-white/10 bg-[#171717] px-4 py-3 text-white focus:border-[#4a7cff]/70 focus:outline-none"
      >
        <option value="EQUAL">Equal</option>
        <option value="CUSTOM">Custom</option>
        <option value="PER_ITEM">Per Item</option>
      </select>
      <div className="rounded-2xl border border-white/10 bg-[#171717] p-4">
        <p className="mb-2 text-sm font-semibold text-slate-200">{t("expense.participants")}</p>
        <div className="space-y-1 text-sm text-slate-400">
          {preview.map((row) => (
            <div key={row.memberId} className="flex justify-between">
              <span>{row.name}</span>
              <span>Rp {row.amount.toLocaleString("id-ID")}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="w-full rounded-xl bg-[#4a7cff] py-3 font-semibold text-white transition active:scale-[0.98]" type="submit">
        {t("expense.submit")}
      </button>
      {submitMessage ? <p className="text-sm text-[#9fbbff]">{submitMessage}</p> : null}
    </form>
  );
}
