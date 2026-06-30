interface CorsConfig {
  origin: string[] | string;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge?: number;
}

interface CorsOptions {
  allowedOrigins?: string | string[];
  allowCredentials?: boolean;
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

export function createCorsConfig(options: CorsOptions = {}): CorsConfig {
  const {
    allowedOrigins = "*",
    allowCredentials = true,
    allowedMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization", "X-Tenant-ID"],
    exposedHeaders = ["X-Tenant-ID"],
    maxAge = 86400,
  } = options;

  return {
    origin: allowedOrigins,
    credentials: allowCredentials,
    methods: allowedMethods,
    allowedHeaders,
    exposedHeaders,
    maxAge,
  };
}

export function validateCorsOrigin(
  origin: string | null,
  allowedOrigins: string | string[]
): boolean {
  if (!origin) return false;

  if (allowedOrigins === "*") return true;

  const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];
  return origins.includes(origin);
}
