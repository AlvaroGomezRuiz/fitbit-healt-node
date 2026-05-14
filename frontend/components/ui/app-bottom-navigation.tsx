"use client";

import { Dumbbell, HeartPulse, Home, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/nutrition", label: "Nutrición", Icon: UtensilsCrossed },
  { href: "/trainer", label: "Entreno", Icon: Dumbbell },
  { href: "/health", label: "Salud", Icon: HeartPulse },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname === "";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppBottomNavigation(): React.ReactElement {
  const pathnameRaw = usePathname();
  const pathname = pathnameRaw ?? "/";

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-[max(0.5rem,env(safe-area-inset-bottom,0))] pt-1 backdrop-blur-md supports-backdrop-filter:bg-card/80"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg py-2 text-sm font-medium leading-snug tracking-tight outline-none transition-colors touch-manipulation",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon aria-hidden strokeWidth={1.75} className="mx-auto size-5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
