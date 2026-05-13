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
    config.resolve = resolve;
    return config;
  },
};

export default nextConfig;
