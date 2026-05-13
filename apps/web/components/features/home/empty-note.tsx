import * as React from "react";

export function EmptyNote(props: { readonly children: React.ReactNode }): React.ReactElement {
  return (
    <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      {props.children}
    </p>
  );
}
