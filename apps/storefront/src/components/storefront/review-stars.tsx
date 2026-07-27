"use client";

import { cn } from "@/lib/utils";

interface ReviewStarsProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  count?: number;
}

const sizeClasses = { sm: "text-sm", md: "text-base", lg: "text-xl" };

export function ReviewStars({ rating, maxRating = 5, size = "md", showValue, count }: ReviewStarsProps) {
  const full = Math.floor(rating);
  const fraction = rating - full;

  return (
    <div className={cn("flex items-center gap-1", sizeClasses[size])}>
      {Array.from({ length: maxRating }).map((_, i) => {
        const fill = i < full ? "full" : i === full && fraction > 0 ? "partial" : "empty";
        return (
          <span
            key={i}
            className={cn(
              fill === "full" && "text-yellow-400",
              fill === "partial" && "text-yellow-400/50",
              fill === "empty" && "text-muted-foreground/20",
            )}
          >
            ★
          </span>
        );
      })}
      {showValue && (
        <span className="text-sm font-medium text-muted-foreground ml-1">
          {rating.toFixed(1)}
        </span>
      )}
      {count !== undefined && (
        <span className="text-sm text-muted-foreground">
          ({count})
        </span>
      )}
    </div>
  );
}
