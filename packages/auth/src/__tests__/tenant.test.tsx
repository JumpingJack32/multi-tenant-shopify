import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  TenantProvider,
  useTenantId,
  useActiveTenant,
  useSetTenantId,
} from "../tenant";

afterEach(() => {
  cleanup();
});
import type { ReactNode } from "react";

function TestConsumer() {
  const tenantId = useTenantId();
  const activeTenant = useActiveTenant();
  const setTenantId = useSetTenantId();
  return (
    <div>
      <div data-testid="tenant-id">{tenantId ?? "null"}</div>
      <div data-testid="active-tenant">{activeTenant?.name ?? "null"}</div>
      <button
        data-testid="set-tenant-btn"
        onClick={() => setTenantId("tenant-123")}
      >
        Set
      </button>
    </div>
  );
}

function TestActiveTenantSetter() {
  const setTenantId = useSetTenantId();
  const activeTenant = useActiveTenant();
  const setActiveTenant = (
    tenant: { id: string; name: string; slug: string } | null,
  ) => {
    (setTenantId as unknown as (id: string | null) => void)(tenant?.id ?? null);
    (
      activeTenant as unknown as { setter: (t: typeof tenant) => void }
    )?.setter?.(tenant);
  };
  return null;
}

describe("TenantProvider", () => {
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
    expect(screen.getByTestId("tenant-id").textContent).toBe("null");
  });

  it("provides null active tenant by default", () => {
    render(
      <TenantProvider>
        <TestConsumer />
      </TenantProvider>,
    );
    expect(screen.getByTestId("active-tenant").textContent).toBe("null");
  });

  it("updates tenant ID via setTenantId", () => {
    render(
      <TenantProvider>
        <TestConsumer />
      </TenantProvider>,
    );
    fireEvent.click(screen.getByTestId("set-tenant-btn"));
    expect(screen.getByTestId("tenant-id").textContent).toBe("tenant-123");
  });
});

describe("useTenantId", () => {
  it("throws when used outside TenantProvider", () => {
    expect(() => render(<TestConsumer />)).toThrow(
      "useTenantId must be used within a TenantProvider",
    );
  });
});

describe("useActiveTenant", () => {
  it("throws when used outside TenantProvider", () => {
    function Consumer() {
      useActiveTenant();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow(
      "useActiveTenant must be used within a TenantProvider",
    );
  });
});

describe("useSetTenantId", () => {
  it("throws when used outside TenantProvider", () => {
    function Consumer() {
      useSetTenantId();
      return null;
    }
    expect(() => render(<Consumer />)).toThrow(
      "useSetTenantId must be used within a TenantProvider",
    );
  });
});
