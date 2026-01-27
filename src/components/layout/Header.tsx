"use client";

import Link from "next/link";
import { SidebarCollapse, SidebarExpand } from "iconoir-react";
import { useSidebar } from "./SidebarProvider";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface HeaderProps {
  children?: React.ReactNode;
  breadcrumb?: string | BreadcrumbItem[];
}

export function Header({
  children,
  breadcrumb,
}: HeaderProps) {
  const { isOpen, toggle, close } = useSidebar();

  const renderBreadcrumb = () => {
    if (!breadcrumb) return null;
    if (typeof breadcrumb === "string") {
      return <span className="text-primary">{breadcrumb}</span>;
    }
    if (breadcrumb.length === 0) return null;

    return (
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-xs">
          {breadcrumb.map((item, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                {item.href && !isLast ? (
                  <Link
                    href={item.href}
                    onClick={close}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-primary" : "text-muted-foreground"}>
                    {item.label}
                  </span>
                )}
                {!isLast && <span className="text-muted-foreground/60">/</span>}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div
        className={`h-12 px-4 flex items-center justify-between text-xs transition-[padding] duration-200 ${
          isOpen ? "lg:pl-52" : "lg:pl-4"
        }`}
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggle}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <SidebarCollapse className="w-4 h-4" strokeWidth={1.5} />
            ) : (
              <SidebarExpand className="w-4 h-4" strokeWidth={1.5} />
            )}
          </button>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-primary hover:text-foreground transition-colors">
              Sprite Forge
            </Link>
          </div>
          {breadcrumb && (
            <>
              <div className="w-px h-4 bg-border" />
              {renderBreadcrumb()}
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {children ? (
            children
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="status-dot status-dot-online animate-pulse-terminal" />
                <span className="text-muted-foreground">System Online</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <span className="text-muted-foreground data-readout">
                {new Date().toISOString().split("T")[0]}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
