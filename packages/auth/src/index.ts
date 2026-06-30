// Auth Provider
export { AuthProvider } from "./provider";

// Tenant Context
export {
  TenantProvider,
  useTenantId,
  useActiveTenant,
  useSetTenantId,
} from "./tenant";

// Hooks
export {
  useAuth,
  useAppUser,
  useIsAuthenticated,
  useSessionToken,
} from "./hooks";

// API Client
export {
  ApiClient,
  createApiClient,
} from "./client";
export type { ApiClientConfig } from "./client";

// Middleware
export {
  createClerkMiddleware,
  defaultAuthRoutes,
} from "./middleware";
export type { AuthRouteConfig } from "./middleware";

// Server-side exports
export {
  auth,
  currentUser,
} from "@clerk/nextjs/server";

// Standalone server utilities (Route Handlers)
export {
  verifyClerkToken,
  getCurrentUser,
} from "./server";
