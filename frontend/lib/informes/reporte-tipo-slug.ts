import type { ReporteHtmlTipo } from "@/lib/data/reportes-html";

const TIPO_TO_SLUG: Readonly<Record<ReporteHtmlTipo, string>> = {
  PRE_ENTRENO: "pre-entreno",
  POST_ENTRENO: "post-entreno",
  RESUMEN_NOCHE: "resumen-noche",
} as const;

const SLUG_TO_TIPO: Readonly<Record<string, ReporteHtmlTipo>> = {
  "pre-entreno": "PRE_ENTRENO",
  "post-entreno": "POST_ENTRENO",
  "resumen-noche": "RESUMEN_NOCHE",
};

export function reporteHtmlTipoToSlug(tipo: ReporteHtmlTipo): string {
  return TIPO_TO_SLUG[tipo];
}

export function reporteHtmlTipoFromSlug(slug: string): ReporteHtmlTipo | null {
  const hit = SLUG_TO_TIPO[slug];
  return hit ?? null;
}

export function reporteHtmlTipoLabelsEs(tipo: ReporteHtmlTipo): string {
  switch (tipo) {
    case "PRE_ENTRENO":
      return "Pre-entreno";
    case "POST_ENTRENO":
      return "Post-entreno";
    case "RESUMEN_NOCHE":
      return "Resumen noche";
    default: {
      const x: never = tipo;
      return x;
    }
  }
}
