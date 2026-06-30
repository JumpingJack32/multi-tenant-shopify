export type Role = "admin" | "member" | "viewer";

export const ROLES = {
  ADMIN: "admin" as Role,
  MEMBER: "member" as Role,
  VIEWER: "viewer" as Role,
} as const;

export type Permission = "create" | "read" | "update" | "delete";

export interface RolePermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export const PERMISSIONS: Record<Role, RolePermissions> = {
  admin: { create: true, read: true, update: true, delete: true },
  member: { create: true, read: true, update: true, delete: false },
  viewer: { create: false, read: true, update: false, delete: false },
};

export interface RbacContextValue {
  role: Role;
  hasPermission: (action: Permission) => boolean;
  can: (action: Permission) => boolean;
  roles: typeof ROLES;
}
