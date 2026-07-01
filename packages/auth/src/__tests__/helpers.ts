import { ApiClient } from "../client";

export function createFetchClient(
  baseUrl: string = "http://localhost:8000"
): ApiClient {
  return new ApiClient({ baseUrl });
}

export function mockFetchResponse<T>(data: T, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
  } as Response;
}
