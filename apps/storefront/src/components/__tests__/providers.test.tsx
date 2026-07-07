import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Providers } from "../providers";

describe("Providers", () => {
  it("renders children", () => {
    render(
      <Providers>
        <div data-testid="child">hello</div>
      </Providers>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });
});
