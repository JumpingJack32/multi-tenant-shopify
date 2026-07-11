"use client";

import { create } from "zustand";

interface TenantSettingsState {
  currency: string;
  storeName: string;
  setSettings: (currency: string, storeName: string) => void;
}

export const useTenantStore = create<TenantSettingsState>((set) => ({
  currency: "USD",
  storeName: "Store",
  setSettings: (currency, storeName) => set({ currency, storeName }),
}));
