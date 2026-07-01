import { motion } from '@repo/ui/components/motion';
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
      {/* <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <p>Welcome to the Storefront!</p>
      </motion.div> */}
    </main>
  );
}
