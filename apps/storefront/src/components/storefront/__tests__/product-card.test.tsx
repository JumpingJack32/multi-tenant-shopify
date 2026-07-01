import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProductCard } from "../product-card";

afterEach(() => {
  cleanup();
});

describe("ProductCard", () => {
  it("renders name and price", () => {
    render(<ProductCard name="Test Product" price={2999} />);
    expect(screen.getByText("Test Product")).toBeDefined();
    expect(screen.getByText("$29.99")).toBeDefined();
  });

  it("renders description when provided", () => {
    render(
      <ProductCard name="Test" price={1000} description="A great product" />,
    );
    expect(screen.getByText("A great product")).toBeDefined();
  });

  it("does not render description when null", () => {
    render(<ProductCard name="Test" price={1000} description={null} />);
    expect(screen.queryByText("A great product")).toBeNull();
  });
});
