"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectTrigger,
  SelectItem,
} from "@repo/ui/components/ui/select";
import { useCallback, useEffect, useState } from "react";

// Just creating a loose type for Base UI's specific event details argument to make TS happy
type SelectRootChangeEventDetails = any;

const CURRENCIES = [
  { code: "🇬🇧", label: "GBP 🇬🇧" },
  { code: "🇪🇺", label: "EUR 🇪🇺" },
  { code: "USD", label: "USD 🇺🇸" },
  { code: "CAD", label: "CAD 🇨🇦" },
  { code: "AUD", label: "AUD 🇦🇺" },
  { code: "CHF", label: "CHF 🇨🇭" },
  { code: "SEK", label: "SEK 🇸🇪" },
  { code: "NOK", label: "NOK 🇳🇴" },
  { code: "DKK", label: "DKK 🇩🇰" },
  { code: "PLN", label: "PLN 🇵🇱" },
  { code: "CZK", label: "CZK 🇨🇿" },
  { code: "HUF", label: "HUF 🇭🇺" },
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

  // FIX 1: Match the full signature expected by Base UI
  const handleValueChange = useCallback(
    (value: string | null, eventDetails?: SelectRootChangeEventDetails) => {
      if (!value) return;

      setCurrent(value);
      setCookie(COOKIE_NAME, value);
      localStorage.setItem(COOKIE_NAME, value);
      window.location.reload();
    },
    [],
  );

  return (
    /**  FIX 2: Wrapped in a div to hold the className, since <Select> doesn't accept it
     * The <Select> root component in shadcn/ui does not accept a className prop because
     * it is a wrapper component that only manages the state and context of the dropdown.
     *   // ❌ WRONG: This will throw a TypeScript error or be ignored
     *   <Select className="w-[180px] bg-blue-50">
     *    ...
     *   </Select>
     *   //  RIGHT: Apply your layout and styles to the visible sub-components
     *   <Select>
     *     <SelectTrigger className="w-[180px] bg-blue-50 border-blue-200">
     *      ...
     *   </Select>
     * */
    // <div className="bg-transparent text-sm text-muted-foreground hover:text-foreground cursor-pointer border-none outline-none">
    <Select
      value={current}
      onValueChange={handleValueChange}
      aria-label="Select currency"
    >
      <SelectTrigger
        className="bg-transparent text-sm text-muted-foreground hover:text-foreground cursor-pointer border-none outline-none select-none"
        aria-label="Select currency"
      >
        {current}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {CURRENCIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
    // </div>
  );
}

//
// "use client";
//
// import { useCallback, useEffect, useState } from "react";
// import { Select } from "@repo/ui/components/ui/select";
//
// const CURRENCIES = [
//   { code: "GBP", label: "GBP 🇬🇧" },
//   { code: "EUR", label: "EUR 🇪🇺" },
//   { code: "USD", label: "USD 🇺🇸" },
//   { code: "CAD", label: "CAD 🇨🇦" },
//   { code: "AUD", label: "AUD 🇦🇺" },
//   { code: "JPY", label: "JPY 🇯🇵" },
//   { code: "CHF", label: "CHF 🇨🇭" },
//   { code: "SEK", label: "SEK 🇸🇪" },
//   { code: "NOK", label: "NOK 🇳🇴" },
//   { code: "DKK", label: "DKK 🇩🇰" },
//   { code: "PLN", label: "PLN 🇵🇱" },
//   { code: "CZK", label: "CZK 🇨🇿" },
//   { code: "HUF", label: "HUF 🇭🇺" },
// ] as const;
//
// const COOKIE_NAME = "preferred_currency";
//
// function getCookie(name: string): string | undefined {
//   if (typeof document === "undefined") return undefined;
//   const match = document.cookie.match(`(?:^|;\\s*)${name}=([^;]*)`);
//   return match?.[1];
// }
//
// function setCookie(name: string, value: string, days = 365) {
//   const expires = new Date(Date.now() + days * 864e5).toUTCString();
//   document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
// }
//
// export function CurrencySwitcher({
//   defaultCurrency,
// }: {
//   defaultCurrency?: string;
// }) {
//   const [current, setCurrent] = useState(defaultCurrency ?? "GBP");
//
//   useEffect(() => {
//     const saved = getCookie(COOKIE_NAME);
//     if (saved && CURRENCIES.some((c) => c.code === saved)) {
//       setCurrent(saved);
//     }
//   }, []);
//
//   const handleChange = useCallback(
//     (e: React.ChangeEvent<HTMLSelectElement>) => {
//       const code = e.target.value;
//       setCurrent(code);
//       setCookie(COOKIE_NAME, code);
//       localStorage.setItem(COOKIE_NAME, code);
//       window.location.reload();
//     },
//     [],
//   );
//
//   return (
//     <select
//       value={current}
//       onChange={handleChange}
//       className="bg-transparent text-sm text-muted-foreground hover:text-foreground cursor-pointer border-none outline-none"
//       aria-label="Select currency"
//     >
//       {CURRENCIES.map((c) => (
//         <option key={c.code} value={c.code}>
//           {c.label}
//         </option>
//       ))}
//     </select>
//   );
// }
