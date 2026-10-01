import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import { loadEnv, type Plugin } from "vite";

/**
 * Serves api/*.ts locally, so `npm run dev` works without Vercel.
 * Each file exports POST/GET(req: Request) => Response, the same contract Vercel calls.
 * Server-only keys (OPENROUTER_API_KEY, ...) come from .env / .env.local like on Vercel.
 * Python routes (api/verify.py) aren't served; callers already treat them as unavailable.
 */
export function apiDev(): Plugin {
  return {
    name: "hopper-api-dev",
    apply: "serve",
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), "");
      for (const [k, v] of Object.entries(env)) if (!k.startsWith("VITE_") && process.env[k] === undefined) process.env[k] = v;

      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/([a-z0-9-]+)(?:[/?]|$)/i.exec(req.url ?? "");
        if (!m || m[1].startsWith("_")) return next();
        const file = `api/${m[1]}.ts`;
        if (!existsSync(file)) return next();
        try {
          const mod = await server.ssrLoadModule(`/${file}`);
          const handler = mod[req.method ?? "GET"] as ((r: Request) => Promise<Response> | Response) | undefined;
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const body = req.method === "GET" || req.method === "HEAD" ? undefined : (Readable.toWeb(req) as ReadableStream);
          const request = new Request(new URL(req.url!, `http://${req.headers.host}`), {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body,
            duplex: "half",
          } as RequestInit);
          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          // Piped, not buffered: streamed lessons and checks arrive as they're written, like on Vercel.
          if (!response.body) return res.end();
          for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
          res.end();
        } catch (e) {
          server.config.logger.error(`[api] ${file}: ${String(e)}`);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}
