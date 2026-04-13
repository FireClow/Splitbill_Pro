type BalanceCardProps = {
  name: string;
  amount: number;
};

export function BalanceCard({ name, amount }: BalanceCardProps) {
  const positive = amount >= 0;
  return (
    <div className="surface-card animate-rise p-4">
      <p className="text-sm text-slate-400">{name}</p>
      <p className={`mt-2 text-xl font-bold ${positive ? "text-emerald-400" : "text-rose-400"}`}>
        {positive ? "+" : "-"}Rp {Math.abs(amount).toLocaleString("id-ID")}
      </p>
    </div>
  );
}
