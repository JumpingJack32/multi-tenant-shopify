import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Cart } from "../cart";
import { useCart } from "@/hooks/use-cart";

afterEach(() => {
  cleanup();
  useCart.getState().clear();
});

describe("Cart", () => {
  it("shows empty state with 0 items", () => {
    render(<Cart />);
    expect(screen.getByText("Cart (0 items)")).toBeDefined();
  });

  it("displays items with name and formatted price", () => {
    useCart.getState().addItem("1", "Test Product", 2999);
    render(<Cart />);
    expect(screen.getByText("Test Product")).toBeDefined();
    expect(screen.getAllByText("£29.99").length).toBeGreaterThanOrEqual(1);
  });

  it("calculates grand total correctly", () => {
    useCart.getState().addItem("1", "Product A", 2999, undefined, 2);
    useCart.getState().addItem("2", "Product B", 4002);
    render(<Cart />);
    expect(screen.getByText("£100.00")).toBeDefined();
  });
});
