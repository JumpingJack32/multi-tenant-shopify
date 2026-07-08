import { CollectionsTable } from "@/components/collections/collections-table";

export default function CollectionsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Collections</h1>
        <p className="text-muted-foreground">Manage product collections</p>
      </div>
      <CollectionsTable />
    </div>
  );
}
