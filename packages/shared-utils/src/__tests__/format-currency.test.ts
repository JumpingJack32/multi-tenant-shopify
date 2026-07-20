import { describe, it, expect } from "vitest";
import { formatCurrency } from "../index";

describe("formatCurrency", () => {
  it("formats GBP (cents-based, default)", () => {
    expect(formatCurrency(1250)).toBe("£ 12.50");
  });

  it("formats USD", () => {
    expect(formatCurrency(1250, "USD")).toBe("$ 12.50");
  });

  it("formats EUR", () => {
    expect(formatCurrency(1250, "EUR")).toBe("€ 12.50");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("£ 0.00");
  });

  it("handles large values", () => {
    expect(formatCurrency(123456789, "GBP")).toBe("£ 1,234,567.89");
  });
});
