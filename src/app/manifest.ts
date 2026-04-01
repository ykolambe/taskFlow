import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaskFlow — Multi-Tenant Task Manager",
    short_name: "TaskFlow",
    description: "A powerful multi-tenant task management platform",
    start_url: "/platform/login",
    scope: "/",
    display: "standalone",
    background_color: "#101522",
    theme_color: "#101522",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/pwa-screenshot-wide.png",
        sizes: "924x530",
        type: "image/png",
        form_factor: "wide",
        label: "TaskFlow desktop workspace view",
      },
      {
        src: "/pwa-screenshot-mobile.png",
        sizes: "720x1280",
        type: "image/png",
        label: "TaskFlow mobile workspace view",
      },
    ],
  };
}
