import type * as React from "react";

import { BottomNav } from "@/components/layout/bottom-nav";

interface AppShellProps {
  readonly children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps): React.ReactElement {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <main
        id="contenido-principal"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] text-base leading-relaxed"
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
