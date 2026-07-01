import { describe, it, expect } from "vitest";
import { cn } from "../index";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("resolves tailwind conflicts (later wins)", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});
