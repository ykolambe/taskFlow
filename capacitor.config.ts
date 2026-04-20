import type { CapacitorConfig } from "@capacitor/cli";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const serverUrl = (
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://localhost:3000"
).replace(/\/$/, "");

const isCleartext = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.taskflow.app",
  appName: "TaskFlow",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: isCleartext,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT",
    },
    SplashScreen: {
      /** Keep visible until the WebView finishes the first load; hide from `CapacitorSplashScreen`. */
      launchAutoHide: false,
      launchFadeOutDuration: 320,
      backgroundColor: "#090d17",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;
