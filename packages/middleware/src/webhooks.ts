import { createHmac, timingSafeEqual } from "crypto";

interface SvixSignatureOptions {
  webhookSecret: string;
  signature: string;
  timestamp: string;
  body: string;
}

function verifyTimestamp(timestamp: string, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return false;
  }
  return now - ts < maxAgeMs;
}

export function verifySvixSignature(options: SvixSignatureOptions): boolean {
  const { webhookSecret, signature, timestamp, body } = options;

  if (!verifyTimestamp(timestamp)) {
    throw new Error("Webhook timestamp too old");
  }

  const expectedSignature = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${body}`)
    .digest("base64");

  const valid = timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!valid) {
    throw new Error("Invalid Svix signature");
  }

  return true;
}
