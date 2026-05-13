import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const cfgDir = path.dirname(fileURLToPath(import.meta.url));

/** Monorepo root: Next solo carga `.env*` bajo `apps/web`; así `SUPABASE_SERVICE_ROLE_KEY` en la raíz llega a Server Actions. */
const monorepoRoot = path.join(cfgDir, "..", "..");
void loadEnvConfig(monorepoRoot);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(cfgDir, "../.."),
  experimental: {
    externalDir: true,
    webpackBuildWorker: false,
    cpus: 1,
  },
  webpack: (config, ctx) => {
    if (!ctx.dev) {
      config.cache = false;
    }
    const resolve = config.resolve ?? {};
    resolve.extensionAlias = {
      ...resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    // Código en ../../lib/ai resuelve node_modules desde la raíz del repo; en Vercel
    // solo existe apps/web/node_modules → forzar paquetes usados por lib/ai.
    const alias = { ...(typeof resolve.alias === "object" && resolve.alias !== null && !Array.isArray(resolve.alias) ? resolve.alias : {}) };
    alias.zod = path.join(cfgDir, "node_modules", "zod");
    resolve.alias = alias;
    config.resolve = resolve;
    return config;
  },
};

export default nextConfig;
