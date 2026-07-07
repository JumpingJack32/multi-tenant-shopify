import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyShopifySignature } from "../shopify";

function computeHmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf-8").digest("base64");
}

const BODY = JSON.stringify({ test: "data" });
const SECRET = "my-shop-secret";

describe("verifyShopifySignature", () => {
  it("returns true for valid signature", () => {
    const hmac = computeHmac(BODY, SECRET);
    expect(
      verifyShopifySignature({ hmac, body: BODY, shopSecret: SECRET }),
    ).toBe(true);
  });

  it("throws for invalid signature", () => {
    const hmac = computeHmac(BODY, "wrong-secret");
    expect(() =>
      verifyShopifySignature({ hmac, body: BODY, shopSecret: SECRET }),
    ).toThrow("Invalid Shopify webhook signature");
  });

  it("throws for empty body", () => {
    const hmac = computeHmac("", SECRET);
    expect(() =>
      verifyShopifySignature({ hmac, body: "", shopSecret: "other-secret" }),
    ).toThrow("Invalid Shopify webhook signature");
  });
});
