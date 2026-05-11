import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  // Server-side render by default; SPA mode would set this to false.
  ssr: true,
  // Activate the Vercel preset only when actually deploying to Vercel,
  // so local dev / Docker self-host don't pull it in.
  presets: process.env.VERCEL ? [vercelPreset()] : [],
} satisfies Config;
