import type { Config } from "@react-router/dev/config";
import { createRequire } from "node:module";

// Only resolve @vercel/react-router when actually deploying on Vercel.
// Using a runtime require (instead of a top-level static import) means
// local dev / Docker builds don't fail if the package isn't installed.
const presets = process.env.VERCEL
  ? [createRequire(import.meta.url)("@vercel/react-router/vite").vercelPreset()]
  : [];

export default {
  // Server-side render by default; SPA mode would set this to false.
  ssr: true,
  presets,
} satisfies Config;
