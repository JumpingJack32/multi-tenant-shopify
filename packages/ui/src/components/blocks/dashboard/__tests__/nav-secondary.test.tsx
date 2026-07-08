import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { NavSecondary } from "../nav-secondary";

function renderWithSidebar(ui: React.ReactElement) {
  return render(<SidebarProvider>{ui}</SidebarProvider>);
}

describe("NavSecondary", () => {
  const linkItems = [{ title: "Help", url: "/help", icon: <span>icon</span> }];

  const dropdownItems = [
    {
      title: "Settings",
      icon: <span>icon</span>,
      items: [
        { title: "Users & Permissions", url: "/settings/users" },
        { title: "Payments", url: "/settings/payments" },
      ],
    },
  ];

  it("renders link items", () => {
    renderWithSidebar(<NavSecondary items={linkItems} />);
    expect(screen.getByText("Help")).toBeInTheDocument();
    expect(screen.getByText("Help").closest("a")).toHaveAttribute(
      "href",
      "/help",
    );
  });

  it("renders dropdown items with sub-items", () => {
    renderWithSidebar(<NavSecondary items={dropdownItems} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Users & Permissions")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
  });

  it("sets mt-auto class via props spread", () => {
    const { container } = renderWithSidebar(
      <NavSecondary items={linkItems} className="mt-auto" />,
    );
    const group = container.querySelector('[data-slot="sidebar-group"]');
    expect(group).toHaveClass("mt-auto");
  });
});
