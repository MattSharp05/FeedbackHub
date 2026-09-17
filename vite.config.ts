import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // The support-desk API sends no CORS headers, so the browser can't call
      // it cross-origin; proxy it same-origin (vercel.json mirrors this).
      "/support-desk": {
        target: "https://support-desk-sandbox.onrender.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/support-desk/, ""),
      },
    },
  },
});
