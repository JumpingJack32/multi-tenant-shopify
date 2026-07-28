"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Loader2Icon } from "@repo/ui/icons";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Address {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  postal_code: string;
  country: string;
}

interface AddressSelectorProps {
  tenantSlug: string;
  customerEmail: string;
  selectedId?: string;
  onSelect: (address: Address | null) => void;
}

export function AddressSelector({ tenantSlug, customerEmail, selectedId, onSelect }: AddressSelectorProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("");

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["addresses", tenantSlug, customerEmail],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/api/v1/storefront/${tenantSlug}/customers/${encodeURIComponent(customerEmail)}/addresses`);
      return r.json();
    },
    enabled: !!customerEmail,
  });

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, string>) => {
      await fetch(`${API_URL}/api/v1/storefront/${tenantSlug}/customers/${encodeURIComponent(customerEmail)}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setShowForm(false);
      setLine1(""); setLine2(""); setCity(""); setPostal(""); setCountry("");
    },
  });

  const list = (addresses ?? []) as Address[];

  if (isLoading) return <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <div className="space-y-1">
          {list.map((a) => (
            <label key={a.id} className="flex items-start gap-2 p-2 rounded border border-border has-[:checked]:border-primary cursor-pointer">
              <input
                type="radio"
                name="address"
                checked={selectedId === a.id}
                onChange={() => onSelect(a)}
                className="mt-0.5 accent-primary"
              />
              <div className="text-sm">
                <p>{a.line1}</p>
                <p className="text-xs text-muted-foreground">{a.city}, {a.postal_code}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-2 border rounded p-3">
          <Input placeholder="Address line 1" value={line1} onChange={(e) => setLine1(e.target.value)} aria-label="Address line 1" />
          <Input placeholder="Address line 2 (optional)" value={line2} onChange={(e) => setLine2(e.target.value)} aria-label="Address line 2" />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" />
            <Input placeholder="Postal code" value={postal} onChange={(e) => setPostal(e.target.value)} aria-label="Postal code" />
          </div>
          <Input placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" />
          <Button size="sm" onClick={() => saveMutation.mutate({ line1, line2, city, postal_code: postal, country })} disabled={saveMutation.isPending || !line1 || !city || !postal}>
            {saveMutation.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Save Address"}
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          Add New Address
        </Button>
      )}
    </div>
  );
}
