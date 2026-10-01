import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
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
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  worker: { format: "es" },
});
