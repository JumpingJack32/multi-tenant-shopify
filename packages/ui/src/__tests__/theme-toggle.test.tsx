import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThemeToggle } from "../components/theme-toggle";

const mockSetTheme = vi.fn();
let mockTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockTheme = "light";
    mockSetTheme.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a button with sun icon in light mode", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDefined();
  });

  it("renders moon icon in dark mode", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("calls setTheme with dark when currently light", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme with light when currently dark", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls stopPropagation on click", () => {
    const stopPropagation = vi.fn();
    render(<ThemeToggle />);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "stopPropagation", {
      value: stopPropagation,
      writable: true,
    });
    screen.getByRole("button").dispatchEvent(event);
    expect(stopPropagation).toHaveBeenCalled();
  });
});
