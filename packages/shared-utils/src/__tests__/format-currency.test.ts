import { describe, it, expect } from "vitest";
import { formatCurrency } from "../index";

describe("formatCurrency", () => {
  it("formats USD (cents-based)", () => {
    expect(formatCurrency(1250, "USD")).toBe("$12.50");
  });

  it("formats EUR", () => {
    expect(formatCurrency(1250, "EUR")).toBe("€12.50");
  });

  it("handles zero", () => {
    expect(formatCurrency(0, "USD")).toBe("$0.00");
  });

  it("handles large values", () => {
    expect(formatCurrency(123456789, "USD")).toBe("$1,234,567.89");
  });
});
