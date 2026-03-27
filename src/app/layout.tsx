import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { Manrope, Playfair_Display } from "next/font/google";
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

export const metadata: Metadata = {
  title: "TaskFlow — Multi-Tenant Task Manager",
  description: "A powerful multi-tenant task management platform",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${manrope.variable} ${playfair.variable}`}>
        {children}
        <Toaster
          position="top-right"
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
