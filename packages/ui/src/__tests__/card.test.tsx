import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/card";

describe("Card", () => {
  it("renders children", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeDefined();
  });

  it("passes through className", () => {
    render(<Card className="custom">Content</Card>);
    expect(screen.getByText("Content").className).toContain("custom");
  });
});

describe("CardDescription", () => {
  it("renders description text", () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText("Description text")).toBeDefined();
  });
});
