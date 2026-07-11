// packages/shared-utils/src/currency.ts

/**
 * Formats an integer (cents) into a localized currency string.
 * Example: 2999 -> "$29.99"
 */
export function formatCents(
  amount: number,
  currency: string = "USD",
  locale: string = "en-US",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    // Minimum and maximum fraction digits are handled automatically by
    // the currency type (e.g., USD gets 2, JPY gets 0).
  }).format(amount / 100);
}
