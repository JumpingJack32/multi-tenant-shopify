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
    const priceElements = screen.getAllByText(/£29\.99/);
    expect(priceElements.length).toBeGreaterThan(0);
  });

  it("calculates item count correctly", () => {
    useCart.getState().addItem("1", "Product A", 1000, undefined, 2);
    useCart.getState().addItem("2", "Product B", 2000);
    render(<Cart />);
    expect(screen.getByText("Cart (3 items)")).toBeDefined();
  });
});
