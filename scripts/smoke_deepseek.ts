import "dotenv/config";

import { runDeepSeekCascade } from "../lib/ai/deepseek-cascade.js";

/**
 * Smoke: una llamada mínima a DeepSeek con system+user provistos por CLI (sin DB).
 * Uso: `rtk npm run smoke:deepseek -- --system "..." --user "..."`
 * Sin args usa mensajes de prueba fijos.
 */
function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[idx + 1];
}

async function main(): Promise<void> {
  const system = readArg("--system") ?? "Respondes en español, una sola frase.";
  const user = readArg("--user") ?? "Di solo: OK smoke DeepSeek.";
  const out = await runDeepSeekCascade({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: 128,
    temperature: 0.1,
  });
  console.log(JSON.stringify({ modelUsed: out.modelUsed, attempts: out.attempts, text: out.text }, null, 2));
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exitCode = 1;
});
