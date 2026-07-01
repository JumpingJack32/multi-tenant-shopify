import { describe, it, expect, beforeEach } from "vitest";
import { useCart } from "../use-cart";

describe("useCart", () => {
  beforeEach(() => {
    useCart.setState({ items: [] });
  });

  it("adds a new item", () => {
    useCart.getState().addItem("1");
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0].quantity).toBe(1);
  });

  it("increments quantity for existing item", () => {
    useCart.getState().addItem("1");
    useCart.getState().addItem("1");
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0].quantity).toBe(2);
  });

  it("removes an item", () => {
    useCart.getState().addItem("1");
    useCart.getState().removeItem("1");
    expect(useCart.getState().items).toHaveLength(0);
  });

  it("clears the cart", () => {
    useCart.getState().addItem("1");
    useCart.getState().addItem("2");
    useCart.getState().clear();
    expect(useCart.getState().items).toHaveLength(0);
  });
});
