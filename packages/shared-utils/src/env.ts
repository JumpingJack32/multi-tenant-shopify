export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnvVarOptional(name: string): string | undefined {
  return process.env[name];
}

export function validateEnv(): {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
} {
  return {
    SUPABASE_URL: getEnvVar("SUPABASE_URL"),
    SUPABASE_KEY: getEnvVar("SUPABASE_KEY"),
    CLERK_SECRET_KEY: getEnvVar("CLERK_SECRET_KEY"),
    CLERK_PUBLISHABLE_KEY: getEnvVar("CLERK_PUBLISHABLE_KEY"),
  };
}
