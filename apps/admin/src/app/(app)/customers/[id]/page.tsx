"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CustomerDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/customers?id=${id}`);
  }, [router, id]);

  return null;
}
