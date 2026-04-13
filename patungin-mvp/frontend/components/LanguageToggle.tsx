"use client";

import { Locale } from "@/messages";
import { useAppStore } from "@/store/useAppStore";
import { useShallow } from "zustand/react/shallow";

export function LanguageToggle() {
  const { locale, setLocale } = useAppStore(useShallow((s) => ({ locale: s.locale, setLocale: s.setLocale })));

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-[#1a1a1a]/90 p-1">
      {(["id", "en"] as Locale[]).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLocale(lang)}
          className={`rounded-full px-3 py-1 text-sm font-semibold transition active:scale-[0.98] ${
            locale === lang ? "bg-[#4a7cff] text-white" : "text-slate-300"
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
