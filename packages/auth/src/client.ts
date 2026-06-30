import { getAuth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

/**
 * API client configuration.
 */
export interface ApiClientConfig {
  /** Base URL for API requests */
  baseUrl: string;
  /** Default headers to include */
  defaultHeaders?: Record<string, string>;
}

/**
 * Create a typed API client that automatically:
 * 1. Attaches Clerk session token to Authorization header
 * 2. Forwards tenant context from headers
 * 3. Handles common error responses
 */
export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.defaultHeaders = {
      "Content-Type": "application/json",
      ...config.defaultHeaders,
    };
  }

  /**
   * Fetch with automatic token attachment.
   * Use in Server Components / Route Handlers where NextRequest is available.
   */
  async fetch<T>(
    path: string,
    options: RequestInit = {},
    request?: NextRequest
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    // Get token from Clerk (server-side via getAuth)
    let token: string | null = null;
    if (request) {
      const auth = getAuth(request);
      token = await auth.getToken({ template: "tenant" });
    }

    // Build headers
    const headers = new Headers({
      ...this.defaultHeaders,
      ...(options.headers as Record<string, string> || {}),
    });

    // Attach auth token
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    // Forward tenant context from incoming request
    if (request) {
      const tenantId = request.headers.get("x-tenant-id");
      if (tenantId) {
        headers.set("x-tenant-id", tenantId);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
        status: response.status,
      }));
      const err = new Error(error.message || "API request failed") as Error & {
        status: number;
        data: unknown;
      };
      err.status = response.status;
      err.data = error;
      throw err;
    }

    return response.json();
  }

  /**
   * GET request helper.
   */
  async get<T>(path: string, request?: NextRequest): Promise<T> {
    return this.fetch<T>(path, { method: "GET" }, request);
  }

  /**
   * POST request helper.
   */
  async post<T>(path: string, body: unknown, request?: NextRequest): Promise<T> {
    return this.fetch<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }, request);
  }

  /**
   * PUT request helper.
   */
  async put<T>(path: string, body: unknown, request?: NextRequest): Promise<T> {
    return this.fetch<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    }, request);
  }

  /**
   * PATCH request helper.
   */
  async patch<T>(path: string, body: unknown, request?: NextRequest): Promise<T> {
    return this.fetch<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, request);
  }

  /**
   * DELETE request helper.
   */
  async delete<T>(path: string, request?: NextRequest): Promise<T> {
    return this.fetch<T>(path, { method: "DELETE" }, request);
  }
}

/**
 * Create an API client instance.
 *
 * Usage:
 * ```ts
 * import { createApiClient } from "@repo/auth/client";
 * const api = createApiClient();
 * const products = await api.get<Product[]>("/api/products");
 * ```
 */
export function createApiClient(config?: Partial<ApiClientConfig>): ApiClient {
  const baseUrl = config?.baseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return new ApiClient({
    baseUrl,
    defaultHeaders: config?.defaultHeaders,
  });
}
