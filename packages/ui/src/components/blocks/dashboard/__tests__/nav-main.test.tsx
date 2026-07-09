import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { NavMain } from "../nav-main";

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
    expect(document.querySelector(".lucide-chevron-down")).toBeTruthy();
  });

  it("renders sub-items inside drop-down", () => {
    const { container } = renderWithSidebar(<NavMain items={dropdownItems} />);
    const subLinks = container.querySelectorAll(
      "[data-slot='sidebar-menu-sub-button']",
    );
    expect(subLinks.length).toBe(2);
    expect(subLinks[0]!).toHaveAttribute("href", "/collections");
    expect(subLinks[1]!).toHaveAttribute("href", "/products/inventory");
    expect(subLinks[0]!.textContent).toContain("Collections");
    expect(subLinks[1]!.textContent).toContain("Inventory");
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
    const subLinks = container.querySelectorAll(
      "[data-slot='sidebar-menu-sub-button']",
    );
    expect(subLinks.length).toBe(0);
    // When using a custom LinkComponent, the SidebarMenuSubButton's render
    // prop delegates rendering so the <a> is rendered by MockLink
    const mockLinks = container.querySelectorAll("[data-mock-link]");
    expect(mockLinks.length).toBe(2);
    expect(mockLinks[0]!).toHaveAttribute("href", "/collections");
    expect(mockLinks[0]!.textContent).toContain("Collections");
  });

  it("sub-items are hidden by default (opacity-0)", () => {
    const { container } = renderWithSidebar(<NavMain items={dropdownItems} />);
    const sub = container.querySelector("[data-slot='sidebar-menu-sub']");
    expect(sub).toBeTruthy();
    expect(sub!.className).toContain("opacity-0");
    expect(sub!.className).toContain("invisible");
  });
});
