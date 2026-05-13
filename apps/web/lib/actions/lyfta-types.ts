export type LyftaStructuredPreview = {
  readonly sessionTitle: string;
  readonly sessionDate: string;
  readonly lineCount: number;
  readonly rowFingerprint: string;
};

export type LyftaIngestState =
  | { readonly status: "idle" }
  | {
      readonly status: "success";
      readonly message: string;
      readonly structured: LyftaStructuredPreview;
      readonly insertedId: string;
    }
  | {
      readonly status: "stub";
      readonly message: string;
      readonly structured: LyftaStructuredPreview;
    }
  | { readonly status: "error"; readonly message: string };
