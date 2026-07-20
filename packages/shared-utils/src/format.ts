import { format as formatDateFn, formatRelative as formatRel } from "date-fns";

const SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

export function formatCurrency(
  amount: number,
  currency: string = "GBP",
): string {
  const symbol = SYMBOLS[currency] ?? currency;
  return `${symbol} ${(amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(
  date: Date | string,
  format: string = "PPP",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDateFn(d, format);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatRel(d, new Date());
}
