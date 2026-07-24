import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Build fingerprint (inlined at build time) so the running bundle can be identified
  // from a screenshot — used to confirm whether a device loaded the latest deploy.
  define: {
    __BUILD_ID__: JSON.stringify(
      (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) ||
        process.env.BUILD_ID ||
        new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 12)
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
