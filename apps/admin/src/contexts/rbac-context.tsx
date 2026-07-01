"use client";

import { useAuth } from "@clerk/nextjs";
import { createContext, useContext, type ReactNode, useMemo } from "react";

export type Role = "admin" | "member" | "viewer";

export const ROLES = {
  ADMIN: "admin" as Role,
  MEMBER: "member" as Role,
  VIEWER: "viewer" as Role,
} as const;

export type Permission = "create" | "read" | "update" | "delete";

interface RolePermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

const PERMISSIONS: Record<Role, RolePermissions> = {
  admin: { create: true, read: true, update: true, delete: true },
  member: { create: true, read: true, update: true, delete: false },
  viewer: { create: false, read: true, update: false, delete: false },
};

interface RbacContextValue {
  role: Role;
  hasPermission: (action: Permission) => boolean;
  can: (action: Permission) => boolean;
  roles: typeof ROLES;
}

const RbacContext = createContext<RbacContextValue | null>(null);

function extractRole(sessionClaims: unknown): Role {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return ROLES.VIEWER;
  }

  const claims = sessionClaims as Record<string, unknown>;
  const metadata = claims.metadata as Record<string, unknown> | null;
  const roles = metadata?.roles as string[] | undefined;

  if (!roles || !Array.isArray(roles) || roles.length === 0) {
    return ROLES.VIEWER;
  }

  const highestPriority = ["admin", "member", "viewer"];
  for (const priority of highestPriority) {
    if (roles.includes(priority)) {
      return priority as Role;
    }
  }

  return ROLES.VIEWER;
}

export function RbacProvider({ children }: { children: ReactNode }) {
  const { sessionClaims } = useAuth();

  const role = useMemo(() => extractRole(sessionClaims), [sessionClaims]);

  const value = useMemo<RbacContextValue>(() => {
    const perms = PERMISSIONS[role];
    return {
      role,
      hasPermission: (action: Permission) => perms[action] ?? false,
      can: (action: Permission) => perms[action] ?? false,
      roles: ROLES,
    };
  }, [role]);

  return (
    <RbacContext.Provider value={value}>
      {children}
    </RbacContext.Provider>
  );
}

export function useRbac(): RbacContextValue {
  const context = useContext(RbacContext);
  if (!context) {
    throw new Error("useRbac must be used within a RbacProvider");
  }
  return context;
}
