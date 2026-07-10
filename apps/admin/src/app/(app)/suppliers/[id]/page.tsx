"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useState } from "react";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useDeleteSupplier,
  useSupplier,
  useUpdateSupplier,
} from "@/features/suppliers/hooks/use-suppliers";

const DELIVERY_METHODS = ["email", "portal", "edi", "manual"];

export default function SupplierDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(props.params);
  const router = useRouter();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  const {
    data: supplier,
    isLoading,
    isError,
    error,
    refetch,
  } = useSupplier(id, currentTenantId);
  const updateSupplier = useUpdateSupplier(currentTenantId);
  const deleteSupplier = useDeleteSupplier(currentTenantId);

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // init form from loaded data
  if (supplier && !dirty && !name) {
    setName(supplier.name);
    setContactEmail(supplier.contact_email ?? "");
    setContactPhone(supplier.contact_phone ?? "");
    setDeliveryMethod(supplier.delivery_method);
  }

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await updateSupplier.mutateAsync({
        id,
        data: {
          name: name.trim(),
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
          delivery_method: deliveryMethod,
        },
      });
      setDirty(false);
    } catch (err) {
      setErrorMsg((err as Error)?.message ?? "Failed to update supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteSupplier.mutateAsync(id);
      router.push("/suppliers");
    } catch (err) {
      setErrorMsg((err as Error)?.message ?? "Failed to delete supplier");
      setSaving(false);
    }
  };

  if (tenantLoading || isLoading) {
    return (
      <div className="p-6 max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-2xl">
        <ErrorBanner
          message={(error as Error)?.message ?? "Supplier not found"}
          onRetry={() => refetch()}
        />
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/suppliers")}
        >
          Back to Suppliers
        </Button>
      </div>
    );
  }

  if (!supplier) return null;

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{supplier.name}</h1>
          <p className="text-muted-foreground">Edit supplier details</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/suppliers")}>
          Back
        </Button>
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} />}

      <Card>
        <CardHeader>
          <CardTitle>Supplier Details</CardTitle>
          <CardDescription>Update supplier information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Supplier Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Contact Email</Label>
            <Input
              id="email"
              type="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Contact Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => {
                setContactPhone(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery">Delivery Method</Label>
            <Select
              value={deliveryMethod}
              onValueChange={(v) => {
                if (v !== null) {
                  setDeliveryMethod(v);
                  setDirty(true);
                }
              }}
            >
              <SelectTrigger id="delivery">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_METHODS.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3 justify-between">
        <div>
          {deleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-destructive">Confirm delete?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Yes, Delete"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setDeleteConfirm(true)}
            >
              Delete Supplier
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/suppliers")}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !dirty || !name.trim()}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
