"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Loader2Icon } from "@repo/ui/icons";

import { cn } from "@/lib/utils";

import { ReviewStars } from "./review-stars";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ReviewSectionProps {
  tenantSlug: string;
  productId: string;
  avgRating: number;
  reviewCount: number;
}

export function ReviewSection({ tenantSlug, productId, avgRating, reviewCount }: ReviewSectionProps) {
  const [sort, setSort] = useState("newest");
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", productId, sort],
    queryFn: async () => {
      const r = await fetch(`${API_URL}/api/v1/storefront/${tenantSlug}/products/${productId}/reviews?sort=${sort}`);
      return r.json();
    },
  });

  const list = (reviews ?? []) as Array<{
    id: string;
    rating: number;
    title: string;
    body: string;
    reviewer_name: string;
    is_verified_buyer: boolean;
    helpful_count: number;
    created_at: string;
  }>;

  const handleSubmit = async () => {
    if (!formTitle || !formBody || !formName) return;
    setSubmitting(true);
    try {
      await fetch(`${API_URL}/api/v1/storefront/${tenantSlug}/products/${productId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: formRating,
          title: formTitle,
          body: formBody,
          reviewer_name: formName,
          customer_email: formEmail || undefined,
        }),
      });
      setShowForm(false);
      setFormTitle("");
      setFormBody("");
      setFormName("");
      setFormEmail("");
    } finally {
      setSubmitting(false);
    }
  };

  const breakdown = [0, 0, 0, 0, 0];
  list.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) breakdown[r.rating - 1]!++; });

  return (
    <div className="space-y-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Customer Reviews</h2>
          <div className="flex items-center gap-2 mt-1">
            <ReviewStars rating={avgRating / 100} size="md" showValue count={reviewCount} />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          Write a Review
        </Button>
      </div>

      {/* Star breakdown */}
      {reviewCount > 0 && (
        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = breakdown[star - 1] ?? 0;
            const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-right text-muted-foreground">{star}★</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-xs text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Review form */}
      {showForm && (
        <div className="border rounded p-4 space-y-3 bg-muted/30">
          <h3 className="text-sm font-semibold">Write a Review</h3>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setFormRating(s)} className={`text-xl ${s <= formRating ? "text-yellow-400" : "text-muted-foreground/20"}`}>★</button>
            ))}
          </div>
          <input className="w-full border rounded px-3 py-2 text-sm bg-background" placeholder="Review title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          <textarea className="w-full border rounded px-3 py-2 text-sm bg-background" rows={3} placeholder="Your review" value={formBody} onChange={(e) => setFormBody(e.target.value)} />
          <input className="w-full border rounded px-3 py-2 text-sm bg-background" placeholder="Your name" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <input className="w-full border rounded px-3 py-2 text-sm bg-background" placeholder="Email (for verified badge)" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !formTitle || !formBody || !formName}>
            {submitting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Submit Review"}
          </Button>
        </div>
      )}

      {/* Sort + List */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{list.length} review{list.length !== 1 ? "s" : ""}</p>
        <Select value={sort} onValueChange={(v: string | null) => v && setSort(v)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="highest">Highest Rated</SelectItem>
            <SelectItem value="helpful">Most Helpful</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <div key={r.id} className="border-b border-border pb-4 last:border-0">
              <div className="flex items-center gap-2">
                <ReviewStars rating={r.rating} size="sm" />
                <span className="font-medium text-sm">{r.title}</span>
                {r.is_verified_buyer && <Badge variant="outline" className="text-[10px]">Verified</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                by {r.reviewer_name} — {new Date(r.created_at).toLocaleDateString()}
              </p>
              <p className="text-sm mt-2">{r.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
