export type LyftaAnalyzeState =
  | { readonly status: "idle" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "success"; readonly reply: string };

export const initialLyftaAnalyzeState: LyftaAnalyzeState = { status: "idle" };
