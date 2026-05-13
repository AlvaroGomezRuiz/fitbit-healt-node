# Phase 2 — cliente DeepSeek y prompts (TypeScript)

Módulo desacoplado en `lib/ai/`: sin Supabase ni migraciones. Los prompts replican el texto de `src/engines/brain_engine.py`; el caller pasa contexto inline (strings / JSON serializado).

## Variables de entorno

Ver `.env.example`: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` (opcional; por defecto `https://api.deepseek.com/chat/completions`), `DEEPSEEK_MODEL_CASCADE` o `DEEPSEEK_MODEL_COMPLEX`, reintentos y backoff (`DEEPSEEK_MAX_RETRIES`, `DEEPSEEK_BACKOFF_BASE_MS`, `DEEPSEEK_BACKOFF_MAX_MS`, `DEEPSEEK_TIMEOUT_MS`).

## API

- `runDeepSeekCascade({ messages, temperature?, maxTokens?, modelCascade?, signal? })` → `{ text, modelUsed, attempts }` (`lib/ai/deepseek-cascade.ts`).
- Cascada por defecto: `deepseek-v4-pro` → `deepseek-v4-flash`; en HTTP 429/5xx reintenta con backoff exponencial + jitter y pasa al siguiente modelo.

## Smoke test

Con `.env` local que incluya `DEEPSEEK_API_KEY`:

`rtk npm run smoke:deepseek`

Equivalente: `rtk npx tsx scripts/smoke_deepseek.ts`

Opcional: `rtk npm run smoke:deepseek -- --system "..." --user "..."`

## Typecheck

`rtk npx tsc --noEmit`
