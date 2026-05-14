/**
 * Textos predeterminados (single-user) para estados vacíos o errores controlados en la UI.
 */
export const SINGLE_USER_PLACEHOLDERS = {
  sinDatosAun:
    "Todavía no hay datos que mostrar. Cuando registres planes, rutina o telemetría, verás el contenido aquí.",
  inicio: {
    titulo: "Inicio",
    vacio:
      "Tu panel de resumen está listo. Cuando tengas perfil, rutina, informes o actividad registrados, aparecerán en esta pantalla. Mientras tanto puedes abrir Nutrición, Entrenador o Salud desde el menú.",
  },
  nutricion: {
    titulo: "Nutrición",
    vacio:
      "No hay datos de nutrición para mostrar para este día: falta perfil personal, plan del día o sugerencias de compra. Puedes cambiar de día con los botones o completar tu perfil cuando esté disponible.",
  },
  entrenador: {
    sinAlmacen:
      "No pudimos conectar con tu almacén de datos. Comprueba la configuración del entorno (variables públicas del proyecto web) y las migraciones aplicadas.",
    rutinaNoDisponible:
      "No pudimos cargar la rutina oficial. Revisa la configuración del proyecto o vuelve a intentarlo más tarde.",
    rutinaVacia:
      "Aún no hay días de rutina registrados. Cuando los añadas, aparecerán listados aquí.",
  },
  salud: {
    telemetriaContexto:
      "Aquí se muestran lecturas diarias de la pulsera (ventana en UTC). Requiere el maestro de telemetría activo y la opción de interfaz correspondiente en las variables del proyecto web; la sincronización depende del interruptor de sync en servidor.",
  },
  login: {
    descripcion:
      "Recibirás un enlace mágico por correo para entrar. Sin sesión iniciada, la aplicación sigue en modo de solo lectura como hasta ahora.",
    errorGenerico:
      "No pudimos completar el acceso. Vuelve a pedir el enlace por correo e inténtalo de nuevo.",
  },
} as const;

/** Títulos y vacíos reutilizados en tarjetas del panel (consumidos por componentes de la app). */
export const sectionDailyReportsTitle = "Informes recientes" as const;

export const sectionSavedNotesTitle = "Notas guardadas" as const;

export const emptyDailyReportsRecent =
  "Aún no hay informes recientes. Cuando se generen, aparecerán listados aquí." as const;

export const emptyImportedTrainingSessions =
  "Aún no hay sesiones importadas. Puedes registrar una desde el entrenador." as const;

export const emptySavedNotesLines =
  "Todavía no hay líneas de memoria guardadas. Cuando la IA deje notas, las verás aquí." as const;

export const emptyDashboardBiometria =
  "Sin fila de biometría en la base de datos todavía (objetivo, peso y macros aparecerán aquí cuando exista el registro)." as const;

/** Reservado por si otra vista necesita un pie de pilar; la tarjeta Nutrición del inicio ya no muestra esta línea cuando no hay datos. */
export const emptyPillarBiometria =
  "Sin datos de biometría en base de datos para esta vista." as const;

export const emptyTelemetryPillarSummary =
  "Sin lecturas de pulsera en el último día. Cuando sincronices, verás pasos y sueño aquí." as const;

export const pillarNoNutritionPlanYet =
  "Aún no hay plan del día publicado. Cuando se genere, verás un extracto en esta tarjeta." as const;

export const emptyDailyNutritionPlan =
  "Aún no hay plan del día para esta fecha. Tras la rutina automática debería crearse; también puedes revisar otro día." as const;

export const emptyProfilePersonalNutrition =
  "Sin perfil personal visible. Cuando exista en tu cuenta, los objetivos semanales aparecerán aquí." as const;

export const nutritionPlanIaBulletDiary =
  "Resumen del día generado y guardado para la fecha civil en curso" as const;

export const nutritionShoppingSundayIntro =
  "Lista de compra y menú semanal a partir de las notas de la IA. Si la nota aún no llegó, verás indicaciones claras abajo." as const;

export const sundayCardListFootnote =
  "Los ítems se muestran en formato compacto; revisa cantidades antes de comprar." as const;

export const emptyShoppingListInWeeklyNote =
  "La nota semanal aún no trae una lista estructurada. Cuando la IA la rellene, aparecerá aquí." as const;

export const emptyWeeklyShoppingNote =
  "Todavía no hay una nota semanal de compra y menú. Cuando exista, esta tarjeta se rellenará sola." as const;

export function formatEmptyMenuBlockForDay(dayLabel: string): string {
  return `No hay menú escrito para ${dayLabel}. Cuando la nota incluya ese día, lo verás aquí.`;
}

export const emptyNutritionStructuredList =
  "No se detectaron ítems en lista en este bloque. Puedes pegar cantidades en líneas separadas para verlas como lista." as const;

export const lyftaIngestCardTitle = "Pegar sesión Lyfta" as const;

export const emptyTelemetryDateRange =
  "No hay lecturas en los días mostrados. Cuando la pulsera sincronice, verás tendencias aquí." as const;

export const hintTelemetryRls =
  "Si acabas de configurar el entorno, comprueba permisos de lectura de tu sesión sobre los datos de telemetría." as const;

export const emptyPostEntrenoReports =
  "Aún no hay informes de post-entreno. Cuando el sistema los genere, aparecerán en esta lista." as const;

export const emptyTrainingHistoryVisible =
  "No hay entrenos guardados visibles todavía. Importa o registra una sesión para verla aquí." as const;
