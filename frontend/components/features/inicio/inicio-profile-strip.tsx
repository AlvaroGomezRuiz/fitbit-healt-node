import * as React from "react";

import type { HomeDataBlock } from "@/lib/data/home-dashboard";
import type { BiometriaMaestroRow } from "@/lib/data/biometria-maestro";
import { EmptyNote } from "@/components/features/home/empty-note";
import { friendlyQueryMessage } from "@/components/features/home/query-message";
import { emptyDashboardBiometria } from "@/lib/ui/single-user-placeholders";

export interface InicioProfileStripProps {
  readonly biometria: HomeDataBlock<BiometriaMaestroRow>;
}

function objetivoLegible(tipo: string): string {
  const map: Readonly<Record<string, string>> = {
    CUTTING_AGRESIVO: "déficit marcado",
    CUTTING_SUAVE: "déficit suave",
    MANTENIMIENTO: "mantenimiento",
    VOLUMEN_LIMPIO: "volumen limpio",
    VOLUMEN_AGRESIVO: "volumen agresivo",
  };
  return map[tipo] ?? tipo.replaceAll("_", " ").toLowerCase();
}

export function InicioProfileStrip({ biometria }: InicioProfileStripProps): React.ReactElement {
  return (
    <section
      aria-labelledby="inicio-perfil-heading"
      className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground"
    >
      <h2 id="inicio-perfil-heading" className="text-sm font-semibold text-foreground">
        Perfil
      </h2>
      {biometria.state === "ok" ? (
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          <li className="text-muted-foreground">Nombre</li>
          <li className="font-medium text-foreground sm:text-right">{biometria.data.nombre}</li>
          <li className="text-muted-foreground">Edad</li>
          <li className="font-medium text-foreground sm:text-right">{biometria.data.edad_anos} años</li>
          <li className="text-muted-foreground">Nutrición (estado)</li>
          <li className="font-medium text-foreground sm:text-right">{objetivoLegible(biometria.data.objetivo_tipo)}</li>
          <li className="text-muted-foreground">Altura / peso último</li>
          <li className="font-medium text-foreground sm:text-right">
            {biometria.data.altura_cm} cm · {String(biometria.data.peso_kg)} kg ({biometria.data.fecha_ultimo_pesaje})
          </li>
        </ul>
      ) : biometria.state === "empty" ? (
        <div className="mt-2">
          <EmptyNote>{emptyDashboardBiometria}</EmptyNote>
        </div>
      ) : (
        <div className="mt-2">
          <EmptyNote>{friendlyQueryMessage(biometria.message)}</EmptyNote>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Los valores completos (macros, IMC, banderas) siguen el pipeline semanal; aquí solo un extracto para contexto
        diario.
      </p>
    </section>
  );
}
