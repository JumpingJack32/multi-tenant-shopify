import { Input } from "@repo/ui/base-ui";

interface TableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
}

export function TableToolbar({ search, onSearchChange, onAdd }: TableToolbarProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <Input
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />
      <button onClick={onAdd} className="rounded-md bg-blue-600 px-4 py-2 text-white">
        Add Product
      </button>
    </div>
  );
}
