import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProductGallery } from "../product-gallery";

afterEach(() => {
  cleanup();
});

vi.mock("next/image", () => ({
  default: ({ fill: _fill, ...rest }: Record<string, unknown>) => (
    <img {...rest} />
  ),
}));

describe("ProductGallery", () => {
  it("renders hero image with alt text", () => {
    const images = [
      "https://images.unsplash.com/photo-1",
      "https://images.unsplash.com/photo-2",
    ];
    render(<ProductGallery images={images} name="Test Product" />);

    const imgs = screen.getAllByAltText("Test Product");
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute("src")).toBe(images[0]);
  });

  it("shows placeholder when no images", () => {
    render(<ProductGallery images={[]} name="Test Product" />);

    expect(screen.getByText("Test Product")).toBeDefined();
  });

  it("renders detail images from array", () => {
    const images = [
      "https://images.unsplash.com/photo-1",
      "https://images.unsplash.com/photo-2",
      "https://images.unsplash.com/photo-3",
      "https://images.unsplash.com/photo-4",
      "https://images.unsplash.com/photo-5",
    ];
    render(<ProductGallery images={images} name="Test Product" />);

    const imgs = screen.getAllByRole("img");
    expect(imgs.length).toBe(5);
    expect(imgs[1].getAttribute("src")).toBe(images[1]);
    expect(imgs[2].getAttribute("src")).toBe(images[2]);
  });
});
