"use client";

import { Dumbbell, HeartPulse, Home, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/nutrition", label: "Nutrición", Icon: UtensilsCrossed },
  { href: "/trainer", label: "Entrenador", Icon: Dumbbell },
  { href: "/health", label: "Salud", Icon: HeartPulse },
] as const;

export function BottomNav(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-1 backdrop-blur-md supports-[backdrop-filter]:bg-card/80"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Button
              key={href}
              asChild
              variant="ghost"
              size="sm"
              className={cn(
                "h-auto min-h-11 w-full flex-col gap-1 rounded-lg py-2 font-normal touch-manipulation",
                active && "bg-muted text-foreground",
              )}
            >
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                className="flex w-full flex-col items-center justify-center gap-1 outline-none"
              >
                <Icon aria-hidden strokeWidth={1.75} className="mx-auto size-5 shrink-0" />
                <span className="text-xs font-medium leading-tight tracking-tight">{label}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
