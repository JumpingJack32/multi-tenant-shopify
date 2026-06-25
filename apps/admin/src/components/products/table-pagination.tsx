interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TablePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: TablePaginationProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex items-center justify-between py-4">
      <div className="text-sm text-gray-500">
        Showing {Math.min(page * pageSize, total)} of {total} products
      </div>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-md border px-2 py-1"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        <button
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border px-3 py-1"
        >
          Previous
        </button>
        <button
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border px-3 py-1"
        >
          Next
        </button>
      </div>
    </div>
  );
}
