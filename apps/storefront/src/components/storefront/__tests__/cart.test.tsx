import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";

import { useCartStore } from "@/hooks/use-cart-store";

import { Cart } from "../cart";

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenant: "test-tenant" }),
  useRouter: () => ({ push: vi.fn() }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  useCartStore.getState().setCartId(null);
});

describe("Cart", () => {
  it("renders nothing when no cart exists", () => {
    const { container } = render(<Cart />, { wrapper });
    expect(container.innerHTML).toBe("");
  });

  it("shows loading state when cartId exists but query is pending", () => {
    useCartStore.getState().setCartId("test-cart-id");
    render(<Cart />, { wrapper });
    expect(screen.getByText("Loading...")).toBeDefined();
  });
});
