import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || "development",
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers["Authorization"];
      delete event.request.headers["Cookie"];
      delete event.request.headers["X-API-Key"];
    }
    if (event.request?.data) {
      const body = typeof event.request.data === "string" ? JSON.parse(event.request.data) : event.request.data;
      if (body?.password) body.password = "[REDACTED]";
      if (body?.token) body.token = "[REDACTED]";
      if (body?.apiKey) body.apiKey = "[REDACTED]";
      if (body?.secret) body.secret = "[REDACTED]";
      if (body?.card_number) body.card_number = "[REDACTED]";
      if (body?.cvv) body.cvv = "[REDACTED]";
      event.request.data = body;
    }
    return event;
  },
});
