import { z } from "zod";

export const TenantSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(["active", "suspended", "deleted"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const TenantCreateSchema = TenantSchema.omit({ id: true, created_at: true, updated_at: true });

export const TenantUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  status: z.enum(["active", "suspended", "deleted"]).optional(),
});
