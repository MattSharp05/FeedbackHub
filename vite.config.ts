import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Dev stand-in for Vercel functions: /api/<name> runs the exported method
// handler (GET/POST/PUT) of api/<name>.ts with a Web Request.
function vercelApiDev(): Plugin {
  return {
    name: "vercel-api-dev",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res) => {
        const name = (req.url ?? "/").split("?")[0].replace(/^\/+/, "").split("/")[0];
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const handler = mod[req.method ?? "GET"];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const request = new Request(new URL(req.originalUrl ?? "/", "http://localhost"), {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server code reads secrets from process.env, as on Vercel; .env.local comes
  // from `vercel env pull`. Real environment variables take precedence.
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
    process.env[key] ??= value;
  }
  return {
    plugins: [react(), tailwindcss(), vercelApiDev()],
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
  };
});
