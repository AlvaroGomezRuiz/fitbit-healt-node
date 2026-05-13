import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const cfgDir = path.dirname(fileURLToPath(import.meta.url));

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
