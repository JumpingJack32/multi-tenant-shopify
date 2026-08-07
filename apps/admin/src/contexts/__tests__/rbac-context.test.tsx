import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { RbacProvider, useRbac } from "../rbac-context";

vi.mock("@/contexts/tenant-context", () => ({
  useTenantContext: () => ({
    currentTenantId: "tenant-a",
  }),
}));

const mockRequest = vi.fn();
vi.mock("@/lib/api/client", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

function TestComponent() {
  const { role, can, permissions, isSuperuser } = useRbac();
  return (
    <div>
      <span data-testid="role">{role}</span>
      <span data-testid="perms">{permissions.join(",")}</span>
      <span data-testid="superuser">{isSuperuser ? "yes" : "no"}</span>
      <span data-testid="can-refund">{can("orders.refund") ? "yes" : "no"}</span>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <RbacProvider>
      <TestComponent />
    </RbacProvider>,
  );
}

describe("RbacProvider", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it("fetches permissions and exposes can()", async () => {
    mockRequest.mockResolvedValue({
      permission_keys: ["orders.refund", "customers.read"],
      role_permissions: { admin: ["orders.refund", "customers.read"] },
      my_permissions: ["orders.refund", "customers.read"],
      my_role: "admin",
    });

    renderWithProvider();

    expect(await screen.findByTestId("role")).toHaveTextContent("admin");
    expect(screen.getByTestId("perms")).toHaveTextContent("orders.refund,customers.read");
    expect(screen.getByTestId("can-refund")).toHaveTextContent("yes");
    expect(screen.getByTestId("superuser")).toHaveTextContent("no");
  });

  it("returns false when permission not granted", async () => {
    mockRequest.mockResolvedValue({
      permission_keys: ["orders.refund"],
      role_permissions: { support_agent: ["orders.read"] },
      my_permissions: ["orders.read"],
      my_role: "support_agent",
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("support_agent");
    });
    expect(screen.getByTestId("can-refund")).toHaveTextContent("no");
  });

  it("marks superuser role", async () => {
    mockRequest.mockResolvedValue({
      permission_keys: [],
      role_permissions: {},
      my_permissions: ["*"],
      my_role: "superuser",
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("superuser");
    });
    expect(screen.getByTestId("superuser")).toHaveTextContent("yes");
  });

  it("handles API failure gracefully", async () => {
    mockRequest.mockRejectedValue(new Error("network"));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("viewer");
    });
    expect(screen.getByTestId("can-refund")).toHaveTextContent("no");
  });
});
