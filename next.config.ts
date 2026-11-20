import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  outputFileTracingExcludes: {
    "*": [
      ".next/cache/**",
      "node_modules/.cache/**",
      "node_modules/@prisma/engines/**",
      "node_modules/prisma/**",
      "node_modules/typescript/**",
      "node_modules/vite/**",
      "node_modules/vitest/**",
      "node_modules/eslint/**",
      "node_modules/@eslint/**",
      "node_modules/tsx/**",
      "node_modules/tailwindcss/**",
      "node_modules/@tailwindcss/**",
      "node_modules/@types/**",
      "node_modules/lightningcss*/**",
    ],
  },
};

export default nextConfig;
