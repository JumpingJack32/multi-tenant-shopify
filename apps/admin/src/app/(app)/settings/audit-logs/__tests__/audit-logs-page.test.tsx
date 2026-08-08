import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AuditLogsPage from "../page";

const mockUseRbac = vi.fn();
const mockUseAuditLogs = vi.fn();
const mockExport = vi.fn();

vi.mock("@/contexts/rbac-context", () => ({
  useRbac: () => mockUseRbac(),
}));

vi.mock("@/features/audit/hooks/use-audit-logs", () => ({
  useAuditLogs: (...args: unknown[]) => mockUseAuditLogs(...args),
}));

vi.mock("@/features/audit/api/audit-service", () => ({
  exportAuditLogs: (...args: unknown[]) => mockExport(...args),
}));

const sampleLog = {
  id: "log-1",
  tenant_id: "tenant-a",
  actor_email: "admin@a.com",
  action: "inventory.override",
  resource_type: "variant",
  resource_id: "variant-1",
  details: { qty: 10 },
  created_at: "2026-08-08T10:00:00Z",
};

describe("AuditLogsPage", () => {
  beforeEach(() => {
    mockUseRbac.mockReset().mockReturnValue({ can: (p: string) => p === "audit_logs.read" });
    mockUseAuditLogs.mockReset().mockReturnValue({
      data: { data: [sampleLog], pagination: { page: 1, page_size: 50, total: 1, total_pages: 1 } },
      isLoading: false,
    });
    mockExport.mockReset().mockResolvedValue(undefined);
  });

  it("renders audit log rows", async () => {
    render(<AuditLogsPage />);
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("admin@a.com")).toBeInTheDocument();
    });
    expect(screen.getByText("Inventory Override")).toBeInTheDocument();
  });

  it("blocks without audit_logs.read permission", () => {
    mockUseRbac.mockReturnValue({ can: (p: string) => p !== "audit_logs.read" });
    render(<AuditLogsPage />);
    expect(screen.getByText(/don.t have permission/i)).toBeInTheDocument();
  });

  it("renders export button and triggers download", async () => {
    render(<AuditLogsPage />);
    const exportBtn = screen.getByText("Export CSV");
    exportBtn.click();
    await waitFor(() => expect(mockExport).toHaveBeenCalled());
  });
});
