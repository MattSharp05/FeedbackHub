import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // Dev stand-in for api/app-store-reviews.ts (Vercel function).
      name: "app-store-reviews-api",
      configureServer(server) {
        server.middlewares.use("/api/app-store-reviews", async (_req, res) => {
          try {
            const mod = await server.ssrLoadModule("/src/data/appStore/index.ts");
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(await mod.fetchAppStoreRequests()));
          } catch (err) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      },
    },
  ],
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
