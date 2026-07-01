import { describe, it, expect } from "vitest";
import { verifySvixSignature } from "../webhooks";

describe("verifySvixSignature", () => {
  it("rejects wrong signature", async () => {
    const ts = String(Date.now());
    const { createHmac } = await import("crypto");
    const correctSig = createHmac("sha256", "test-secret")
      .update(`${ts}.${'{"data":"test"}'}`)
      .digest("base64");
    const wrongSig =
      correctSig.slice(0, -1) +
      (correctSig.at(-1) === "A" ? "B" : "A");

    expect(() =>
      verifySvixSignature({
        webhookSecret: "test-secret",
        signature: wrongSig,
        timestamp: ts,
        body: '{"data":"test"}',
      }),
    ).toThrow("Invalid Svix signature");
  });

  it("rejects expired timestamp", () => {
    const oldTimestamp = String(Date.now() - 10 * 60 * 1000);
    expect(() =>
      verifySvixSignature({
        webhookSecret: "test-secret",
        signature: "some-signature",
        timestamp: oldTimestamp,
        body: '{"data":"test"}',
      }),
    ).toThrow("Webhook timestamp too old");
  });
});
