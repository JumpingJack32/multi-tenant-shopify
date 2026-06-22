"use client";

import { useClerk } from "@clerk/nextjs";
import { Button } from "@repo/ui/base-ui";

export function LogoutButton() {
  const { signOut } = useClerk();

  return (
    <Button
      // variant="secondary"
      onClick={() => signOut({ redirectUrl: "/auth/sign-in" })}
    >
      Sign out
    </Button>
  );
}
