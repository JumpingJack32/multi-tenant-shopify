import { describe, it, expect } from "vitest";
import { formatDate, formatRelativeTime } from "../index";

describe("formatDate", () => {
  it("formats an ISO string", () => {
    const result = formatDate("2026-06-01T12:00:00Z");
    expect(result).toContain("2026");
  });
});

describe("formatRelativeTime", () => {
  it('returns a relative string for recent dates', () => {
    const result = formatRelativeTime(new Date().toISOString());
    expect(result.toLowerCase()).toContain("today");
  });
});
