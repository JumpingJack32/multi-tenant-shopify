"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { SaveIcon, PlusIcon, RotateCcwIcon } from "@repo/ui/icons";

import { useTenantContext } from "@/contexts/tenant-context";
import {
  useNavigationMenus,
  useNavigationTree,
  useReconcileNavigationTree,
  useCreateMenu,
  useUpdateMenu,
} from "@/features/navigation/api/use-navigation-admin";
import {
  ItemPropertiesDrawer,
  type NavItemFormData,
} from "@/features/navigation/components/item-properties-drawer";
import { TreeBuilder } from "@/features/navigation/components/tree-builder";

export default function NavigationAdminPage() {
  const { currentTenantId } = useTenantContext();
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [localItems, setLocalItems] = useState<NavItemFormData[]>([]);
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addingToParent, setAddingToParent] = useState<string | null>(null);
  const initialItemsRef = useRef<string>("");

  const menusQuery = useNavigationMenus(currentTenantId);
  const treeQuery = useNavigationTree(selectedMenuId, currentTenantId);
  const reconcileMutation = useReconcileNavigationTree(
    selectedMenuId ?? "",
    currentTenantId,
  );
  const createMenuMutation = useCreateMenu(currentTenantId);
  const updateMenuMutation = useUpdateMenu(
    selectedMenuId ?? "",
    currentTenantId,
  );

  const menus = (menusQuery.data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
  }>;
  const treeData = treeQuery.data as
    | { id: string; slug: string; title: string; items: NavItemFormData[] }
    | undefined;

  // Load tree data into local state
  useEffect(() => {
    if (treeData?.items) {
      setLocalItems(treeData.items);
      initialItemsRef.current = JSON.stringify(treeData.items);
      setDirty(false);
    }
  }, [treeData]);

  // Track dirty state
  useEffect(() => {
    const initial = initialItemsRef.current;
    const current = JSON.stringify(localItems);
    setDirty(initial !== current);
  }, [localItems]);

  const handleSave = useCallback(async () => {
    if (!selectedMenuId) return;
    await reconcileMutation.mutateAsync({ items: localItems as unknown[] });
    initialItemsRef.current = JSON.stringify(localItems);
    setDirty(false);
  }, [selectedMenuId, localItems, reconcileMutation]);

  const handleDiscard = useCallback(() => {
    if (treeData?.items) {
      setLocalItems(treeData.items);
      initialItemsRef.current = JSON.stringify(treeData.items);
      setDirty(false);
    }
  }, [treeData]);

  const findItem = useCallback(
    (id: string): NavItemFormData | null => {
      const search = (items: NavItemFormData[]): NavItemFormData | null => {
        for (const item of items) {
          if (item.id === id) return item;
          const children = (item as any).children ?? [];
          const found = search(children);
          if (found) return found;
        }
        return null;
      };
      return search(localItems);
    },
    [localItems],
  );

  const updateItemInTree = useCallback(
    (
      items: NavItemFormData[],
      id: string,
      updater: (item: NavItemFormData) => NavItemFormData,
    ): NavItemFormData[] => {
      return items.map((item) => {
        if (item.id === id) return updater(item);
        const children = (item as any).children ?? [];
        if (children.length > 0) {
          return { ...item, children: updateItemInTree(children, id, updater) };
        }
        return item;
      });
    },
    [],
  );

  const removeItemFromTree = useCallback(
    (items: NavItemFormData[], id: string): NavItemFormData[] => {
      return items
        .filter((item) => item.id !== id)
        .map((item) => {
          const children = (item as any).children ?? [];
          if (children.length > 0) {
            return { ...item, children: removeItemFromTree(children, id) };
          }
          return item;
        });
    },
    [],
  );

  const handleEdit = useCallback((id: string) => {
    setEditingItemId(id);
    setAddingToParent(null);
    setDrawerOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setLocalItems((prev) => removeItemFromTree(prev, id));
    },
    [removeItemFromTree],
  );

  const handleAddChild = useCallback((parentId: string | null) => {
    setEditingItemId(null);
    setAddingToParent(parentId);
    setDrawerOpen(true);
  }, []);

  const handleDrawerSave = useCallback(
    (formData: NavItemFormData) => {
      if (editingItemId) {
        setLocalItems((prev) =>
          updateItemInTree(prev, editingItemId, (item) => ({
            ...item,
            ...formData,
          })),
        );
      } else {
        const newItem: NavItemFormData & { children: NavItemFormData[] } = {
          ...formData,
          id: formData.id || crypto.randomUUID(),
          children: [],
        };
        setLocalItems((prev) => {
          const addTo = (items: NavItemFormData[]): NavItemFormData[] => {
            if (addingToParent === null) {
              return [...items, newItem];
            }
            return items.map((item) => {
              if (item.id === addingToParent) {
                return {
                  ...item,
                  children: [...((item as any).children ?? []), newItem],
                };
              }
              const children = (item as any).children ?? [];
              if (children.length > 0) {
                return { ...item, children: addTo(children) };
              }
              return item;
            });
          };
          return addTo(prev);
        });
      }
      setDrawerOpen(false);
      setEditingItemId(null);
      setAddingToParent(null);
    },
    [editingItemId, addingToParent, updateItemInTree],
  );

  const editingItem = useMemo(
    () => (editingItemId ? findItem(editingItemId) : null),
    [editingItemId, findItem],
  );

  const selectedMenu = menus.find((m) => m.id === selectedMenuId);

  if (menusQuery.isPending) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Navigation</h1>
        <div className="flex items-center gap-2">
          {dirty && (
            <>
              <Badge
                variant="outline"
                className="text-yellow-600 border-yellow-400"
              >
                Unsaved changes
              </Badge>
              <Button variant="outline" size="sm" onClick={handleDiscard}>
                <RotateCcwIcon className="mr-1 h-3 w-3" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={reconcileMutation.isPending}
              >
                <SaveIcon className="mr-1 h-3 w-3" />
                {reconcileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Menu:</label>
          <Select
            value={selectedMenuId ?? ""}
            onValueChange={(v: string | null) => v && setSelectedMenuId(v)}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a menu" />
            </SelectTrigger>
            <SelectContent>
              {menus.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title} ({m.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedMenu && (
          <div className="flex items-center gap-2">
            {!dirty && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddChild(null)}
              >
                <PlusIcon className="mr-1 h-3 w-3" />
                Add Root Item
              </Button>
            )}
          </div>
        )}
      </div>

      {selectedMenuId ? (
        treeQuery.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{selectedMenu?.title}</CardTitle>
              <CardDescription>
                Drag to reorder or use the arrow buttons
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TreeBuilder
                items={localItems}
                onItemsChange={setLocalItems}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAddChild={handleAddChild}
              />
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Select a menu to start editing
          </CardContent>
        </Card>
      )}

      <ItemPropertiesDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initial={editingItem}
        onSave={handleDrawerSave}
      />
    </div>
  );
}
