import { format as formatDateFn, formatRelative as formatRel } from "date-fns";

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export function formatDate(date: Date | string, format: string = "PPP"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDateFn(d, format);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatRel(d, new Date());
}
