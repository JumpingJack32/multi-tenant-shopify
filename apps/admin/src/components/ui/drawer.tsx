"use client";

import { Dialog } from "@repo/ui/base-ui";
import { useRef } from "react";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Drawer({ open, onOpenChange, title, children, size = "md" }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const widthClass = {
    sm: "w-full sm:w-96",
    md: "w-full sm:w-[540px]",
    lg: "w-full sm:w-[720px]",
  }[size];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop overlay */}
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />

        {/* Drawer panel - classes applied to Content, not Portal */}
        <Dialog.Popup
          ref={panelRef}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex flex-col border-l bg-background shadow-xl outline-none",
            widthClass,
          )}
        >
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>

            {/* Dialog.Close renders a <button> by default, so we style it directly */}
            <Dialog.Close
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Close drawer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Dialog.Close>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Utility function to merge class names
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}