import Link from "next/link";
import * as React from "react";

export default function NotFound(): React.ReactElement {
  return (
    <main className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">No encontrado</h1>
      <p className="max-w-md text-sm text-muted-foreground">La ruta solicitada no existe en esta aplicación.</p>
      <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Volver al inicio
      </Link>
    </main>
  );
}
