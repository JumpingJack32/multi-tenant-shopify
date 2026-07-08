"use client";

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
import { useState, useEffect } from "react";

import { CategoryModal } from "./category-modal";

interface Category {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  product_count: number;
}

export function CategoriesTable() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadCategories() {
    try {
      const res = await fetch("/api/v1/categories/");
      if (res.ok) {
        const data = (await res.json()) as Category[];
        setCategories(data);
      }
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/v1/categories/${id}`, { method: "DELETE" });
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently fail
    }
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
          <Plus className="mr-2 h-4 w-4" /> Add Category
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
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {cat.slug}
                </TableCell>
                <TableCell>
                  <Badge variant={cat.is_active ? "default" : "secondary"}>
                    {cat.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {cat.product_count} items
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(cat);
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
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        )}
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Are you absolutely sure?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {cat.product_count > 0
                              ? `This category contains ${cat.product_count} product(s). Deleting it will unassign them all. This action cannot be undone.`
                              : "This action will permanently remove this category. This action cannot be undone."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(cat.id)}
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
            ))}
          </TableBody>
        </Table>

        {categories.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No categories yet.
          </div>
        )}
      </div>

      {showModal && (
        <CategoryModal
          category={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            loadCategories();
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
