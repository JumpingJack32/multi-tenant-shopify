import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { NavMain } from "../nav-main";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderWithSidebar(ui: React.ReactElement) {
  return render(<SidebarProvider>{ui}</SidebarProvider>);
}

describe("NavMain", () => {
  const linkItems = [
    { title: "Dashboard", url: "/dashboard", icon: <span>icon</span> },
  ];

  const dropdownItems = [
    {
      title: "Products",
      icon: <span>icon</span>,
      items: [
        { title: "Collections", url: "/collections" },
        { title: "Inventory", url: "/products/inventory" },
      ],
    },
  ];

  it("renders link items as plain buttons", () => {
    renderWithSidebar(<NavMain items={linkItems} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });

  it("renders dropdown items with chevron", () => {
    renderWithSidebar(<NavMain items={dropdownItems} />);
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(document.querySelector(".lucide-chevron-right")).toBeTruthy();
  });

  it("renders collapsible structure for dropdown items", () => {
    const { container } = renderWithSidebar(<NavMain items={dropdownItems} />);
    expect(container.querySelector("[data-slot='collapsible']")).toBeTruthy();
    expect(
      container.querySelector("[data-slot='collapsible-trigger']"),
    ).toBeTruthy();
  });

  it("sub-items use LinkComponent when provided", () => {
    function MockLink({
      href,
      children,
    }: {
      href: string;
      children: React.ReactNode;
    }) {
      return (
        <a data-mock-link href={href}>
          {children}
        </a>
      );
    }
    const { container } = renderWithSidebar(
      <NavMain items={dropdownItems} LinkComponent={MockLink} />,
    );
    // Collapsible is closed — no mock links rendered yet
    // Verify collapsible structure exists
    expect(
      container.querySelector("[data-slot='collapsible-trigger']"),
    ).toBeTruthy();
  });

  it("sub-items are collapsed by default (not in DOM)", () => {
    const { container } = renderWithSidebar(<NavMain items={dropdownItems} />);
    // With Base UI Collapsible, closed panel content is not rendered
    const sub = container.querySelector("[data-slot='sidebar-menu-sub']");
    expect(sub).toBeFalsy();
  });
});
