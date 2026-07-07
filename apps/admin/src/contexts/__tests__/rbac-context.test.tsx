import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { RbacProvider, useRbac } from "../rbac-context";

vi.mock("@clerk/nextjs", () => ({
  useAuth: vi.fn(() => ({
    sessionClaims: {
      metadata: {
        roles: ["viewer"],
      },
    },
  })),
}));

function TestComponent() {
  const { role, can } = useRbac();
  return (
    <div data-testid="role">
      {role} - {can("create") ? "can create" : "cannot create"}
    </div>
  );
}

describe("RbacProvider", () => {
  it("provides viewer role with limited access by default", () => {
    render(
      <RbacProvider>
        <TestComponent />
      </RbacProvider>,
    );
    expect(screen.getByTestId("role").textContent).toContain("viewer");
    expect(screen.getByTestId("role").textContent).toContain("cannot create");
  });
});
