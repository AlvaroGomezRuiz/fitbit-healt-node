/**
 * Errores tipados del cliente DeepSeek (sin `any`).
 */

export class DeepSeekConfigError extends Error {
  public override readonly name = "DeepSeekConfigError";
  public constructor(message: string) {
    super(message);
  }
}

export class DeepSeekParseError extends Error {
  public override readonly name = "DeepSeekParseError";
  public constructor(
    message: string,
    public readonly zodIssues: readonly { path: string; message: string }[],
  ) {
    super(message);
  }
}

export class DeepSeekEmptyContentError extends Error {
  public override readonly name = "DeepSeekEmptyContentError";
  public constructor(
    message: string,
    public readonly model: string,
    public readonly finishReason: string,
  ) {
    super(message);
  }
}

export class DeepSeekHttpError extends Error {
  public override readonly name = "DeepSeekHttpError";
  public constructor(
    message: string,
    public readonly status: number,
    public readonly bodySnippet: string,
  ) {
    super(message);
  }
}

export class DeepSeekCascadeExhaustedError extends Error {
  public override readonly name = "DeepSeekCascadeExhaustedError";
  public constructor(
    message: string,
    public readonly attempts: number,
    public readonly causes: readonly string[],
  ) {
    super(message);
  }
}
