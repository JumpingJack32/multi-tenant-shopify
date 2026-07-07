import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import SignInPage from "../page";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true }),
  useSignIn: () => ({
    signIn: {
      create: vi.fn(),
      finalize: vi.fn(),
    },
  }),
  useClerk: () => ({}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("SignInPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders sign-in form", () => {
    render(<SignInPage />);
    expect(screen.getByText("Sign in to Admin")).toBeDefined();
    expect(screen.getByText("Continue with Google")).toBeDefined();
    expect(screen.getByText("Continue with GitHub")).toBeDefined();
  });

  it("renders email and password inputs", () => {
    render(<SignInPage />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeDefined();
    expect(screen.getByPlaceholderText("••••••••")).toBeDefined();
  });

  it("has a sign-in button", () => {
    render(<SignInPage />);
    expect(screen.getByText("Sign in")).toBeDefined();
  });
});
