import * as React from "react";

export default function InformesLoading(): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground" role="status">
      Cargando informes…
    </div>
  );
}
