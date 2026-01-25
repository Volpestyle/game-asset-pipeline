"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  User,
  Play,
  Download,
  Settings
} from "iconoir-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  code: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home, code: "DSH" },
  { href: "/characters", label: "Characters", icon: User, code: "CHR" },
  { href: "/animations", label: "Animations", icon: Play, code: "ANM" },
  { href: "/export", label: "Export", icon: Download, code: "EXP" },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-10 bottom-0 w-48 border-r border-border bg-background/95 backdrop-blur-sm z-40">
      <div className="flex flex-col h-full">
        <nav className="flex-1 py-4">
          <div className="px-3 mb-2">
            <span className="text-[10px] text-muted-foreground tracking-wider">Navigation</span>
          </div>
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 text-xs transition-colors ${
                      active
                        ? "bg-primary/10 text-primary border-l-2 border-primary -ml-px"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span className="flex-1">{item.label}</span>
                    <span className={`text-[9px] tracking-wider ${active ? "text-primary" : "text-muted-foreground/50"}`}>
                      {item.code}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-3 border-t border-border">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Settings className="w-4 h-4" strokeWidth={1.5} />
            <span>Settings</span>
          </Link>
          <div className="mt-3 px-3 text-[10px] text-muted-foreground/50">
            <div>Sprite Forge</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
