"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type SidebarContextValue = {
  isOpen: boolean;
  isLarge: boolean;
  toggle: () => void;
  close: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpenLarge, setIsOpenLarge] = useState(true);
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const [isLarge, setIsLarge] = useState(false);

  const toggle = useCallback(() => {
    if (isLarge) {
      setIsOpenLarge((prev) => !prev);
      return;
    }
    setOpenPathname((prev) => (prev === pathname ? null : pathname));
  }, [isLarge, pathname]);

  const close = useCallback(() => {
    if (!isLarge) {
      setOpenPathname(null);
    }
  }, [isLarge]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const applyMatch = (matches: boolean) => {
      setIsLarge(matches);
      if (matches) {
        setIsOpenLarge(true);
      } else {
        setOpenPathname(null);
      }
    };

    applyMatch(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      applyMatch(event.matches);
    };

    mediaQuery.addEventListener("change", handler);

    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, []);

  const isOpen = isLarge ? isOpenLarge : openPathname === pathname;

  const value = useMemo(
    () => ({
      isOpen,
      isLarge,
      toggle,
      close,
    }),
    [isOpen, isLarge, toggle, close]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}
