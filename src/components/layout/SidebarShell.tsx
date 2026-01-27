"use client";

import { useSidebar } from "./SidebarProvider";

export function SidebarShell({ children }: { children: React.ReactNode }) {
  const { isOpen } = useSidebar();

  return (
    <div
      className={`transition-[padding] duration-200 ${
        isOpen ? "pl-0 lg:pl-48" : "pl-0"
      }`}
    >
      {children}
    </div>
  );
}
