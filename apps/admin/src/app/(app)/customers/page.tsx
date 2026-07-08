import { CustomersTable } from "@/components/customers/customers-table";

export default function CustomersPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground">View and manage customers</p>
      </div>
      <CustomersTable />
    </div>
  );
}
