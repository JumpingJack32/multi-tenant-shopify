import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnvVar, getEnvVarOptional, validateEnv } from "../env";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...OLD_ENV };
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("getEnvVar", () => {
  it("returns value when variable exists", () => {
    process.env.TEST_VAR = "hello";
    expect(getEnvVar("TEST_VAR")).toBe("hello");
  });

  it("throws when variable is missing", () => {
    expect(() => getEnvVar("MISSING_VAR")).toThrow(
      "Missing required environment variable: MISSING_VAR",
    );
  });

  it("throws for empty string value", () => {
    process.env.EMPTY_VAR = "";
    expect(() => getEnvVar("EMPTY_VAR")).toThrow(
      "Missing required environment variable: EMPTY_VAR",
    );
  });
});

describe("getEnvVarOptional", () => {
  it("returns value when variable exists", () => {
    process.env.TEST_OPT = "world";
    expect(getEnvVarOptional("TEST_OPT")).toBe("world");
  });

  it("returns undefined when variable is missing", () => {
    expect(getEnvVarOptional("MISSING_OPT")).toBeUndefined();
  });
});

describe("validateEnv", () => {
  it("returns all required env vars", () => {
    process.env.SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_KEY = "sb-key";
    process.env.CLERK_SECRET_KEY = "sk_test_xxx";
    process.env.CLERK_PUBLISHABLE_KEY = "pk_test_xxx";
    const result = validateEnv();
    expect(result.SUPABASE_URL).toBe("https://supabase.test");
    expect(result.SUPABASE_KEY).toBe("sb-key");
    expect(result.CLERK_SECRET_KEY).toBe("sk_test_xxx");
    expect(result.CLERK_PUBLISHABLE_KEY).toBe("pk_test_xxx");
  });

  it("throws when any var is missing", () => {
    process.env.SUPABASE_URL = "https://supabase.test";
    expect(() => validateEnv()).toThrow("SUPABASE_KEY");
  });
});
