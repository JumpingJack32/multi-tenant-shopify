import { describe, it, expect } from "vitest";
import { createClerkMiddleware } from "../middleware";

describe("createClerkMiddleware", () => {
  it("returns a middleware function", () => {
    const middleware = createClerkMiddleware({ secretKey: "test-secret" });
    expect(typeof middleware).toBe("function");
  });
});
