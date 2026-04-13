"use client";

import { create } from "zustand";
import { Locale } from "@/messages";

type AppStore = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  locale: "id",
  setLocale: (locale) => set({ locale }),
}));
