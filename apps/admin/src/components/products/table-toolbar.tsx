"use client";

interface TableToolbarProps {
  search: string;
  onSearchChange: (search: string) => void;
  total: number;
}

export function TableToolbar({
  search,
  onSearchChange,
  total,
}: TableToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="relative flex-1 max-w-sm">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => onSearchChange((e.target as HTMLInputElement).value)}
          className="w-full rounded-lg border bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <span className="text-sm text-muted-foreground">
        {total} result{total !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
