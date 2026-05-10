import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server:{
    allowedHosts:[
      'anita-radiophonic-gametically.ngrok-free.dev',
    ],
    hmr: {
      clientPort: 443, // Forces HMR to use secure port
    },
  }
});
