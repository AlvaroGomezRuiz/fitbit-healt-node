/**
 * Contratos públicos del módulo AI (Phase 2, sin Supabase).
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
}

export interface RunDeepSeekCascadeParams {
  readonly messages: readonly ChatMessage[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Lista ordenada; si se omite, se lee de entorno o valores por defecto. */
  readonly modelCascade?: readonly string[];
  readonly signal?: AbortSignal;
}

export interface RunDeepSeekCascadeResult {
  readonly text: string;
  readonly modelUsed: string;
  readonly attempts: number;
}
