type ReminderChipProps = {
  text: string;
};

export function ReminderChip({ text }: ReminderChipProps) {
  return (
    <div className="rounded-full border border-[#4a7cff]/30 bg-[#4a7cff]/10 px-4 py-2 text-sm font-medium text-[#c8d8ff]">
      {text}
    </div>
  );
}
