// packages/ui/src/index.ts

// Export your custom motion components and the raw primitives
export * from "./components/motion";

// 1. Export all Lucide icons EXCEPT the ones that conflict
// export * from "lucide-react";

// 2. Explicitly export the conflicting Lucide icons with an "Icon" suffix.
// export { Badge as BadgeIcon, Table as TableIcon } from "lucide-react";

// Export your other standard UI components here
export * from "./components/theme-toggle";
export * from "./components/ui/card";
export * from "./components/ui/dialog";
export * from "./components/ui/alert-dialog";
export * from "./components/ui/badge";
export * from "./components/ui/table";

// Re-export shared block components
// export * from "./components/blocks/dashboard-01";
