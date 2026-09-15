import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/analysis/*/export/pdf": ["./src/lib/reports/fonts/*.ttf"],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
