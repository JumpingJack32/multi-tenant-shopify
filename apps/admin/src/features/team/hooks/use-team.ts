"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTenantContext } from "@/contexts/tenant-context";
import {
  fetchTeam,
  inviteUser,
  removeUser,
  transferOwnership,
  updateUser,
  type InvitePayload,
} from "@/features/team/api/users-service";

export function useTeam() {
  const { currentTenantId } = useTenantContext();
  return useQuery({
    queryKey: ["team", currentTenantId],
    queryFn: () => fetchTeam(currentTenantId),
    enabled: !!currentTenantId,
  });
}

export function useInviteUser() {
  const { currentTenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: InvitePayload) =>
      inviteUser(payload, currentTenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useUpdateUser() {
  const { currentTenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patch: Parameters<typeof updateUser>[1] }) =>
      updateUser(vars.id, vars.patch, currentTenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useRemoveUser() {
  const { currentTenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeUser(id, currentTenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useTransferOwnership() {
  const { currentTenantId } = useTenantContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transferOwnership(id, currentTenantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
}
