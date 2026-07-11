"use client";

import { useEffect } from "react";

import { useTenantStore } from "@/hooks/use-tenant-store";

interface Props {
  currency: string;
  storeName: string;
}

export function SettingsHydrator({ currency, storeName }: Props) {
  const setSettings = useTenantStore((s) => s.setSettings);

  useEffect(() => {
    setSettings(currency, storeName);
  }, [currency, storeName, setSettings]);

  return null;
}
