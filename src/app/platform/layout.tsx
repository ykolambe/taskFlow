import { redirect } from "next/navigation";
import { getPlatformUser } from "@/lib/auth";
import PlatformLayout from "@/components/layout/PlatformLayout";

export default async function PlatformRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // login page doesn't need auth check (handled by middleware)
  return <>{children}</>;
}
