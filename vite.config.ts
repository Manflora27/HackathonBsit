import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { apiDev } from "./scripts/vite-api-dev.js";

export default defineConfig({
  plugins: [
    apiDev(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Hopper",
        short_name: "Hopper",
        description: "Finds the exact math skill behind a mistake.",
        theme_color: "#1e2b27",
        background_color: "#f4efe4",
        display: "standalone",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
        globPatterns: ["**/*.{js,mjs,css,html,svg,json,wasm,zip,whl}"],
        // The on-device voice model (onnx wasm + ~75MB weights from the
        // HuggingFace CDN) loads on demand only: precaching it would tax
        // every install, so it stays out of the precache and relies on the
        // runtime caches below + the browser HTTP cache instead.
        globIgnores: ["**/ort-*.wasm"],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(huggingface\.co|cdn-lfs\.huggingface\.co|cdn-lfs\.hf\.co)\/.*/,
            handler: "CacheFirst",
            options: { cacheName: "whisper-models", expiration: { maxEntries: 30 } },
          },
        ],
      },
    }),
  ],
  worker: { format: "es" },
});
