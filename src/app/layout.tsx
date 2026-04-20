import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import { Manrope, Playfair_Display } from "next/font/google";
import CapacitorSplashScreen from "@/components/capacitor/CapacitorSplashScreen";
import PwaServiceWorker from "@/components/PwaServiceWorker";
import PwaInstallButton from "@/components/PwaInstallButton";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const metadataBase =
  appUrl && /^https?:\/\//i.test(appUrl) ? new URL(appUrl) : new URL("http://localhost:3000");

export const metadata: Metadata = {
  metadataBase,
  title: "TaskFlow — Multi-Tenant Task Manager",
  description: "A powerful multi-tenant task management platform",
  appleWebApp: {
    capable: true,
    title: "TaskFlow",
    /** Opaque bar avoids web content visually bleeding under the clock / Dynamic Island in standalone & Capacitor */
    statusBarStyle: "black",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

/** Allow pinch-zoom so PWA/browser users match system font-size / accessibility settings. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#101522",
  /** Required for env(safe-area-inset-*) on iOS notch / Capacitor WebView */
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${manrope.variable} ${playfair.variable} flex min-h-dvh flex-col`}>
        <div className="relative flex min-h-0 flex-1 flex-col box-border w-full pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
          {children}
        </div>
        <CapacitorSplashScreen />
        <PwaServiceWorker />
        <PwaInstallButton />
        <Toaster
          position="top-right"
          containerStyle={{
            top: "max(1rem, env(safe-area-inset-top, 0px))",
          }}
          toastOptions={{
            style: {
              background: "rgba(16, 21, 34, 0.92)",
              color: "#f2f3f7",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              borderRadius: "14px",
              fontSize: "14px",
              backdropFilter: "blur(8px)",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#101522" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#101522" },
            },
          }}
        />
      </body>
    </html>
  );
}
