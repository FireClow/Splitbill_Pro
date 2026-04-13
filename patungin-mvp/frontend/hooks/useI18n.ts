"use client";

import { getMessage } from "@/messages";
import { useAppStore } from "@/store/useAppStore";

export function useI18n() {
  const locale = useAppStore((state) => state.locale);
  const t = (key: Parameters<typeof getMessage>[1]) => getMessage(locale, key);
  return { locale, t };
}
