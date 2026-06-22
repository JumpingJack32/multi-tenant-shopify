"use client";

import { useAuth, UserButton, SignInButton, SignOutButton } from "@clerk/nextjs";

export default function Header() {
  // Extract the authentication state from the hook
  const { isSignedIn } = useAuth();

  return (
    <header className="border-b">
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold">Admin</span>
        <div className="flex items-center gap-4">
          {isSignedIn ? (
            <>
              {/* If you still want a standalone logout button */}
              <SignOutButton>
                <button className="text-sm text-red-500 hover:underline">
                  Logout
                </button>
              </SignOutButton>

              <UserButton />
            </>
          ) : (
            <SignInButton mode="modal" />
          )}
        </div>
      </div>
    </header>
  );
}
