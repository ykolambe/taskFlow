import { redirect } from "next/navigation";

// Pass-through layout — each page handles its own auth and layout
export default function TenantRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
