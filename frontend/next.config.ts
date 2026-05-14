import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const cfgDir = path.dirname(fileURLToPath(import.meta.url));

/** Raíz del repo + `frontend/`: primero raíz (compartido), luego `frontend` (`.env.local` gana en claves repetidas). */
const monorepoRoot = path.join(cfgDir, "..");
void loadEnvConfig(monorepoRoot);
void loadEnvConfig(cfgDir);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(cfgDir, ".."),
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
    // `lib/deepseek-package` comparte node_modules con `frontend/`; forzar zod resoluble en build.
    const alias = { ...(typeof resolve.alias === "object" && resolve.alias !== null && !Array.isArray(resolve.alias) ? resolve.alias : {}) };
    alias.zod = path.join(cfgDir, "node_modules", "zod");
    resolve.alias = alias;
    config.resolve = resolve;
    return config;
  },
};

export default nextConfig;
