import { redirect } from "next/navigation";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export default function HomePage() {
  // const tenant = resolveTenantFromRequest(new Request("http://localhost"));

  // if (!tenant) {
  //   redirect("/");
  // }

  return (
    <main>
      <h1>Storefront - Tenant</h1>
      {/* <h1>Storefront - {tenant}</h1> */}
    </main>
  );
}
