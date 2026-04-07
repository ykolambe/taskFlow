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
};

export default config;
