import * as React from "react";

export interface ReporteHtmlIframeSandboxProps {
  /** HTML almacenado en BD; se muestra en iframe aislado (sin `dangerouslySetInnerHTML` en el documento principal). */
  readonly html: string;
  readonly title: string;
}

/**
 * Visor de informe HTML con sandbox estricto (sin scripts ni formularios salvo lo que el navegador permita por defecto).
 */
export function ReporteHtmlIframeSandbox(props: ReporteHtmlIframeSandboxProps): React.ReactElement {
  return (
    <div role="region" aria-label={props.title} className="flex flex-col gap-1">
      <iframe
        title={props.title}
        sandbox=""
        srcDoc={props.html}
        className="min-h-[60vh] w-full rounded-md border border-border bg-background"
      />
      <p className="text-xs text-muted-foreground">
        Contenido del informe en marco aislado (sandbox); la navegación por teclado puede quedar limitada dentro del
        marco.
      </p>
    </div>
  );
}
