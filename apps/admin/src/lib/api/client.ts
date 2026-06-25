import type { Product, ProductCreate, ProductUpdate } from "@repo/tenant-orm/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { getToken } = await import("@clerk/nextjs");
    return getToken() ?? null;
  } catch {
    return null;
  }
}

interface RequestOptions {
  tenantId?: string | null;
  [key: string]: unknown;
}

export async function request<T>(
  endpoint: string,
  options: RequestInit & RequestOptions = {},
): Promise<T> {
  const { tenantId, ...rest } = options;
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...rest.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (tenantId) {
    headers["X-Tenant-ID"] = tenantId;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => null);
    let message = "Request failed";
    try {
      const error = JSON.parse(body || "{}");
      message = error.detail || error.message || message;
    } catch {
      if (body) message = body;
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export const api = {
  products: {
    list(params?: Record<string, string>) {
      const query = new URLSearchParams(params).toString();
      return request<Product[]>(
        `/products/${query ? `?${query}` : ""}`,
      );
    },

    get(id: string) {
      return request<Product>(
        `/products/${id}`,
      );
    },

    create(data: ProductCreate) {
      return request<Product>(
        "/products",
        { method: "POST", body: JSON.stringify(data) },
      );
    },

    update(id: string, data: ProductUpdate) {
      return request<Product>(
        `/products/${id}`,
        { method: "PUT", body: JSON.stringify(data) },
      );
    },

    delete(id: string) {
      return request<void>(
        `/products/${id}`,
        { method: "DELETE" },
      );
    },
  },
};
