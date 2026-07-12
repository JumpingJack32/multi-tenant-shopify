"use client";

import { useCallback, useEffect, useState } from "react";

const CURRENCIES = [
  { code: "GBP", label: "GBP £" },
  { code: "EUR", label: "EUR €" },
  { code: "USD", label: "USD $" },
  { code: "CAD", label: "CAD $" },
  { code: "AUD", label: "AUD $" },
  { code: "JPY", label: "JPY ¥" },
  { code: "CHF", label: "CHF Fr" },
  { code: "SEK", label: "SEK kr" },
  { code: "NOK", label: "NOK kr" },
  { code: "DKK", label: "DKK kr" },
  { code: "PLN", label: "PLN zł" },
  { code: "CZK", label: "CZK Kč" },
  { code: "HUF", label: "HUF Ft" },
  { code: "BRL", label: "BRL R$" },
  { code: "INR", label: "INR ₹" },
  { code: "CNY", label: "CNY ¥" },
  { code: "SGD", label: "SGD $" },
  { code: "HKD", label: "HKD $" },
  { code: "NZD", label: "NZD $" },
  { code: "ZAR", label: "ZAR R" },
] as const;

const COOKIE_NAME = "preferred_currency";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(`(?:^|;\\s*)${name}=([^;]*)`);
  return match?.[1];
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export function CurrencySwitcher({
  defaultCurrency,
}: {
  defaultCurrency?: string;
}) {
  const [current, setCurrent] = useState(defaultCurrency ?? "GBP");

  useEffect(() => {
    const saved = getCookie(COOKIE_NAME);
    if (saved && CURRENCIES.some((c) => c.code === saved)) {
      setCurrent(saved);
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const code = e.target.value;
      setCurrent(code);
      setCookie(COOKIE_NAME, code);
      localStorage.setItem(COOKIE_NAME, code);
      window.location.reload();
    },
    [],
  );

  return (
    <select
      value={current}
      onChange={handleChange}
      className="bg-transparent text-sm text-muted-foreground hover:text-foreground cursor-pointer border-none outline-none"
      aria-label="Select currency"
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
