type ErrorContext = Record<string, unknown>;

const LOG_ENDPOINT = "/api/v1/public/errors";

export function trackError(error: Error, context?: ErrorContext): void {
  const entry = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    timestamp: new Date().toISOString(),
    ...context,
  };

  console.error("[trackError]", entry);

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(LOG_ENDPOINT, JSON.stringify(entry));
    } catch {
      // silently fail — don't throw from error handler
    }
  }
}
