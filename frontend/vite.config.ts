import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy:
        mode === "development"
          ? {
              "/api": {
                target: env.VITE_API_URL || "http://localhost:8000",
                changeOrigin: true,
              },
            }
          : {},
    },
    build: { outDir: "dist", sourcemap: false },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  };
});
