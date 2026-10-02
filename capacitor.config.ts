import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor shell for the Hopper app (web code in dist/, same as the PWA).
const config: CapacitorConfig = {
  appId: "com.hopper.math",
  appName: "Hopper",
  webDir: "dist",
  backgroundColor: "#f4efe4",
  // Offline: the app runs the bundled dist/ (template lessons, on-device engine), no server needed.
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
