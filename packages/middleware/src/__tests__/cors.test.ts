import { describe, it, expect } from "vitest";
import { validateCorsOrigin, createCorsConfig } from "../cors";

describe("validateCorsOrigin", () => {
  it("returns true for matching origin", () => {
    expect(
      validateCorsOrigin("https://example.com", ["https://example.com"]),
    ).toBe(true);
  });

  it("returns false for non-matching origin", () => {
    expect(
      validateCorsOrigin("https://evil.com", ["https://example.com"]),
    ).toBe(false);
  });

  it("returns true for wildcard", () => {
    expect(validateCorsOrigin("https://anything.com", "*")).toBe(true);
  });

  it("returns false for null origin", () => {
    expect(validateCorsOrigin(null, "*")).toBe(false);
  });
});

describe("createCorsConfig", () => {
  it("returns config with defaults", () => {
    const config = createCorsConfig();
    expect(config.origin).toBe("*");
    expect(config.credentials).toBe(true);
  });
});
