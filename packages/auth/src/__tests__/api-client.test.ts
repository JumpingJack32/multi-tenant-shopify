import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient } from "../client";

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient({ baseUrl: "http://localhost:8000" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a GET request and returns JSON", async () => {
    const mockData = { id: "1", name: "Test" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200 }),
    );

    const result = await client.get("/products");
    expect(result).toEqual(mockData);
  });

  it("throws on 4xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
        statusText: "Not Found",
      }),
    );

    await expect(client.get("/products/999")).rejects.toThrow("Not found");
  });
});
