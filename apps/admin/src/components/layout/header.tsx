import { UserButton } from "@clerk/nextjs";

export function Header() {
  return (
    <header className="border-b">
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold">Admin</span>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
