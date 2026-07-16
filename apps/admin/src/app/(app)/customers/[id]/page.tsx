"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CustomerDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/customers?id=${id}`);
  }, [router, id]);

  return null;
}
