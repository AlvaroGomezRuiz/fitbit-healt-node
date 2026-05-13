import { z } from "zod";

import { DeepSeekParseError } from "./errors.js";

const messageSchema = z.object({
  role: z.string().optional(),
  content: z.union([z.string(), z.null()]).optional(),
});

const choiceSchema = z.object({
  message: messageSchema.optional(),
  finish_reason: z.union([z.string(), z.null()]).optional(),
});

export const deepSeekChatCompletionSchema = z.object({
  choices: z.array(choiceSchema).optional(),
  usage: z
    .object({
      completion_tokens: z.number().optional(),
      completion_tokens_details: z
        .object({
          reasoning_tokens: z.number().optional(),
        })
        .optional(),
    })
    .passthrough()
    .optional(),
});

export type DeepSeekChatCompletion = z.infer<typeof deepSeekChatCompletionSchema>;

export function parseDeepSeekChatCompletion(data: unknown): DeepSeekChatCompletion {
  const parsed = deepSeekChatCompletionSchema.safeParse(data);
  if (!parsed.success) {
    const zodIssues = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new DeepSeekParseError("Respuesta DeepSeek no coincide con el esquema esperado.", zodIssues);
  }
  return parsed.data;
}
