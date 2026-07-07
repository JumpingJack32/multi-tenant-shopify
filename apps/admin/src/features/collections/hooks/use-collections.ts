import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  fetchCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from "../api/collections-service";

export function useCollections(includeInactive?: boolean) {
  return useQuery({
    queryKey: ["collections", { includeInactive }],
    queryFn: () => fetchCollections(includeInactive),
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) => createCollection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      updateCollection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
    },
  });
}
