const SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

export function formatCurrency(
  cents: number,
  currencyCode: string = "GBP",
): string {
  const symbol = SYMBOLS[currencyCode] ?? currencyCode;
  return `${symbol} ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
