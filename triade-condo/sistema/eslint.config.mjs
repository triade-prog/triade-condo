import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores(["**/.next/**", "**/node_modules/**", "**/next-env.d.ts", "supabase/functions/**", "test-results/**", "playwright-report/**", "**/dist/**", "**/.astro/**", "**/.vercel/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    extends: [...nextVitals, ...nextTs],
    settings: { next: { rootDir: ["apps/plataforma/", "apps/console/"] }, react: { version: "19" } },
  },
  {
    files: ["apps/site/astro.config.mjs"],
    languageOptions: { globals: { process: "readonly" } },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      eqeqeq: ["error", "always"],
    },
  },
]);
