import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import AccountPage from "../page";

afterEach(() => {
  cleanup();
});

const mockCreatePortal = vi.fn();
const mockFetchMethods = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenant: "acme-corp" }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: vi.fn(() => ({
    user: null,
    isLoaded: true,
  })),
}));

vi.mock("@/lib/storefront-api", () => ({
  createCustomerPortal: (...args: unknown[]) => mockCreatePortal(...args),
  fetchPaymentMethods: (...args: unknown[]) => mockFetchMethods(...args),
}));

describe("AccountPage", () => {
  beforeEach(() => {
    mockCreatePortal.mockReset();
    mockFetchMethods.mockReset();
  });

  it("renders billing section with email field", () => {
    render(<AccountPage />);
    expect(screen.getByText("Billing & Payment Methods")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByText("Manage Billing")).toBeInTheDocument();
  });

  it("shows guest verification fields (order number / zip)", () => {
    render(<AccountPage />);
    expect(screen.getByText("Order number (optional if using zip)")).toBeInTheDocument();
    expect(screen.getByText("Shipping ZIP (optional if using order number)")).toBeInTheDocument();
  });

  it("launches portal on verification and shows payment methods", async () => {
    mockCreatePortal.mockResolvedValue({ url: "https://billing.stripe.com/session", verified: true });
    mockFetchMethods.mockResolvedValue([
      { id: "pm_1", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 },
    ]);
    const user = userEvent.setup();

    render(<AccountPage />);
    await user.type(screen.getByPlaceholderText("you@example.com"), "guest@example.com");
    await user.type(screen.getByPlaceholderText("#1234"), "SF-1001");
    await user.click(screen.getByText("Manage Billing"));

    await waitFor(() => {
      expect(mockCreatePortal).toHaveBeenCalledWith("acme-corp", {
        customer_email: "guest@example.com",
        order_number: "SF-1001",
        shipping_zip: undefined,
      });
    });
    expect(mockFetchMethods).toHaveBeenCalled();
    expect(await screen.findByText("Saved Payment Methods")).toBeInTheDocument();
    expect(screen.getByText(/4242/)).toBeInTheDocument();
  });

  it("surfaces verification errors", async () => {
    mockCreatePortal.mockRejectedValue(new Error("Verification failed — email must match a paid order"));
    const user = userEvent.setup();

    render(<AccountPage />);
    await user.type(screen.getByPlaceholderText("you@example.com"), "nobody@example.com");
    await user.click(screen.getByText("Manage Billing"));

    expect(
      await screen.findByText("Verification failed — email must match a paid order"),
    ).toBeInTheDocument();
  });
});
