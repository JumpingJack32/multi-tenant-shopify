"use client";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { Plus, Edit2, Trash2 } from "@repo/ui/icons";

import {
  useCollections,
  useDeleteCollection,
} from "@/features/collections/hooks/use-collections";

import { CollectionModal } from "./collection-modal";

interface CollectionsTableProps {
  tenantId?: string | null;
  tenantLoading?: boolean;
}

export function CollectionsTable({
  tenantId,
  tenantLoading,
}: CollectionsTableProps) {
  const {
    data: collections,
    isLoading,
    refetch,
  } = useCollections(true, tenantId);
  const loading = isLoading || tenantLoading;
  const deleteMutation = useDeleteCollection(tenantId);
  const [editing, setEditing] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    await deleteMutation.mutateAsync(id);
    setDeleting(null);
    refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Collection
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm text-muted-foreground">
                      Loading...
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              collections?.map((col: any) => (
                <TableRow key={col.id}>
                  <TableCell className="font-medium">{col.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {col.slug}
                  </TableCell>
                  <TableCell>
                    <Badge variant={col.is_active ? "default" : "secondary"}>
                      {col.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {col.product_count} items
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(col);
                          setShowModal(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={(props) => (
                            <Button
                              {...props}
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deleting === col.id}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />{" "}
                              {deleting === col.id ? "..." : "Delete"}
                            </Button>
                          )}
                        />
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete collection?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {col.product_count > 0
                                ? `This collection contains ${col.product_count} product(s). Deleting will hide it. This action cannot be undone.`
                                : "This will permanently delete this collection. This action cannot be undone."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(col.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {(!collections || collections.length === 0) && !loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No collections yet.
          </div>
        )}
      </div>

      {showModal && (
        <CollectionModal
          collection={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            refetch();
            setShowModal(false);
          }}
          tenantId={tenantId}
        />
      )}
    </div>
  );
}
