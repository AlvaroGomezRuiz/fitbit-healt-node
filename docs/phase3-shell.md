# Fase 3 — Cáscara UI (mock)

La app en `apps/web` es **solo presentación**: rutas móviles, barra inferior, PWA mínima y textos placeholder en español. **No** incluye `@supabase/*`, ni Server Actions que llamen a IA, ni imports de `brain_engine` / DeepSeek. El cableado a fase 1 (datos) y fase 2 (LLM) será posterior.

**PWA:** `app/manifest.ts` genera el manifiesto; los iconos del manifiesto están vacíos de momento. **TODO:** añadir `public/apple-touch-icon.png` (180×180) y, si se desea, `public/icon-192.png` / `public/icon-512.png`, y enlazarlos vía `metadata.icons` en `app/layout.tsx`.
