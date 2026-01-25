import Link from "next/link";

interface HeaderProps {
  children?: React.ReactNode;
  breadcrumb?: string;
  backHref?: string;
}

export function Header({
  children,
  breadcrumb,
  backHref,
}: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="h-12 px-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-primary">Sprite Forge</span>
          </div>
          {backHref && (
            <>
              <div className="w-px h-4 bg-border" />
              <Link href={backHref} className="text-muted-foreground hover:text-primary transition-colors">
                Back
              </Link>
            </>
          )}
          {breadcrumb && (
            <>
              <div className="w-px h-4 bg-border" />
              <span className="text-primary">{breadcrumb}</span>
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
