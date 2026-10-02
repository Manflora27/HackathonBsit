import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor shell for the Hopper app (web code in dist/, same as the PWA).
// Voice input runs the same tiered path as the browser (see src/ai/speech.ts):
// Web Speech where the WebView offers it, otherwise record + on-device Whisper.
//
// Native setup (after `npx cap add android` / `npx cap add ios`):
// - Android: add RECORD_AUDIO + MODIFY_AUDIO_SETTINGS to
//   android/app/src/main/AndroidManifest.xml so getUserMedia can capture.
// - iOS: add NSMicrophoneUsageDescription to Info.plist.
// If a WebView ever blocks getUserMedia outright, swap recordClip() in
// src/ai/speech.ts for @capacitor/voice-recorder (permission + base64 Blob).
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
