"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { ArrowUpDownIcon, SearchIcon } from "@repo/ui/icons";

interface CustomersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  sortOrder: "asc" | "desc";
  onToggleSortOrder: () => void;
}

export function CustomersToolbar({
  search,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onToggleSortOrder,
}: CustomersToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customer..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={onToggleSortOrder}
        title={`Sort ${sortOrder === "asc" ? "ascending" : "descending"}`}
      >
        <ArrowUpDownIcon
          className={`h-4 w-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`}
        />
      </Button>
      <Select
        value={sortBy}
        onValueChange={(v) => onSortByChange(v ?? "created_at")}
      >
        <SelectTrigger className="w-36 h-9">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">Newest</SelectItem>
          <SelectItem value="name">Name</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="total_spent">Amount Spent</SelectItem>
          <SelectItem value="total_orders">Orders</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
