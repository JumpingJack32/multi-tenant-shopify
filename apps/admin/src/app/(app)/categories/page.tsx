import { CategoriesTable } from "@/components/categories/categories-table";

export default function CategoriesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-muted-foreground">Manage product categories</p>
      </div>
      <CategoriesTable />
    </div>
  );
}
