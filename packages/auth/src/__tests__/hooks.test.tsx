import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppUser, useIsAuthenticated, useSessionToken } from "../hooks";

const mockGetToken = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useAuth: vi.fn(() => ({
    isSignedIn: true,
    getToken: mockGetToken,
  })),
  useUser: vi.fn(() => ({
    user: {
      id: "user-123",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      firstName: "Test",
      lastName: "User",
      imageUrl: "https://example.com/avatar.png",
      externalId: "ext-123",
    },
  })),
}));

describe("useAppUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns normalized user data", () => {
    const { result } = renderHook(() => useAppUser());
    expect(result.current).toEqual({
      id: "user-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      imageUrl: "https://example.com/avatar.png",
      externalId: "ext-123",
    });
  });
});

describe("useIsAuthenticated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when signed in", () => {
    const { result } = renderHook(() => useIsAuthenticated());
    expect(result.current).toBe(true);
  });
});

describe("useSessionToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns token from Clerk", async () => {
    mockGetToken.mockResolvedValue("mock-session-token");
    const { result } = renderHook(() => useSessionToken());
    const token = await result.current;
    expect(token).toBe("mock-session-token");
  });

  it("returns null when getToken is not available", async () => {
    mockGetToken.mockReturnValue(null);
    const { result } = renderHook(() => useSessionToken());
    const token = await result.current;
    expect(token).toBeNull();
  });
});
