import { createHmac, timingSafeEqual } from "crypto";

interface ShopifySignatureOptions {
  hmac: string;
  body: string;
  shopSecret: string;
}

export function verifyShopifySignature(options: ShopifySignatureOptions): boolean {
  const { hmac, body, shopSecret } = options;

  const expectedHmac = createHmac("sha256", shopSecret)
    .update(body, "utf-8")
    .digest("base64");

  const valid = timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(expectedHmac)
  );

  if (!valid) {
    throw new Error("Invalid Shopify webhook signature");
  }

  return true;
}
