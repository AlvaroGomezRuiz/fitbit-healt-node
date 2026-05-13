# Parche `.cursorignore` (sustituir `frontend/` → `apps/web/`)

El entorno denegó la escritura directa en `.cursorignore`. Aplica este diff en la raíz del repo (o edita manualmente las mismas líneas).

```diff
--- a/.cursorignore
+++ b/.cursorignore
@@ -28,7 +28,7 @@
 **/dist/**
 **/build/**
 **/out/**
-frontend/.next/**
+apps/web/.next/**
 **/.next/**
 **/.nuxt/**
 **/.svelte-kit/**
@@ -63,9 +63,9 @@ supabase/.branch/**
 
 # 6. Playwright, Coverage & Test Outputs
-frontend/test-results/**
-frontend/playwright-report/**
-frontend/blob-report/**
+apps/web/test-results/**
+apps/web/playwright-report/**
+apps/web/blob-report/**
 **/coverage/**
 **/.nyc_output/**
 
@@ -111,9 +111,9 @@
 !.env
 !.env.example
-!frontend/.env
-!frontend/.env.local
-!frontend/.env.example
+!apps/web/.env
+!apps/web/.env.local
+!apps/web/.env.example
 !supabase/config.toml
 !.cursorrules
 !.geo/

```
