import { cn } from "@repo/shared-utils/cn";

interface StatusBadgeProps {
  status: "draft" | "published" | "archived";
}

const statusStyles = {
  draft: "bg-gray-100 text-gray-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyles[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
