export type AiSmokeState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "success"; readonly reply: string };

export const initialAiSmokeState: AiSmokeState = { status: "idle" };
