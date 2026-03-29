import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaskFlow — Multi-Tenant Task Manager",
    short_name: "TaskFlow",
    description: "A powerful multi-tenant task management platform",
    start_url: "/",
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
  };
}
