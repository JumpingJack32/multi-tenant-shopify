import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { TenantProvider, useTenantContext } from "../tenant-context";

vi.mock("@clerk/nextjs", () => ({
  getToken: vi.fn().mockResolvedValue("mock-token"),
}));

function TestConsumer() {
  const ctx = useTenantContext();
  return (
    <div>
      <div data-testid="tenant-id">{ctx.currentTenantId ?? ""}</div>
      <div data-testid="is-loading">{String(ctx.isLoading)}</div>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe("TenantProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders children", () => {
    render(
      <TenantProvider>
        <div data-testid="child">Hello</div>
      </TenantProvider>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("provides null tenant ID by default", () => {
    render(
      <TenantProvider>
        <TestConsumer />
      </TenantProvider>,
    );
    expect(screen.getByTestId("tenant-id").textContent).toBe("");
  });

  it("throws useTenantContext outside provider", () => {
    expect(() => render(<TestConsumer />)).toThrow(
      "useTenantContext must be used within a TenantProvider",
    );
  });
});
