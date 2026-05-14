import type * as React from "react";

import { AppBottomNavigation } from "@/components/ui/app-bottom-navigation";

interface AppShellProps {
  readonly children: React.ReactNode;
}

/**
 * Cáscara móvil: cabecera con altura fija (evita CLS) + área principal + navegación inferior.
 */
export function AppShell({ children }: AppShellProps): React.ReactElement {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header
        className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
        aria-label="Cabecera de la aplicación"
      >
        <div className="mx-auto flex h-full w-full max-w-lg items-center px-4">
          <p className="text-base font-semibold leading-none text-foreground">Salud</p>
        </div>
      </header>
      <main
        id="contenido-principal"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0))] text-base leading-relaxed"
      >
        {children}
      </main>
      <AppBottomNavigation />
    </div>
  );
}
