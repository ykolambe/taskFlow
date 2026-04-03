import type { Metadata } from "next";
import { getTenantUserFresh } from "@/lib/auth";
import TenantThemeProvider from "@/components/layout/TenantThemeProvider";
import TenantLightBrightness from "@/components/layout/TenantLightBrightness";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

/** Per-slug manifest so Add to Home Screen / install uses this workspace start_url + scope. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    manifest: `/t/${slug}/manifest`,
  };
}

export default async function TenantRootLayout({ children, params }: Props) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  const uiTheme = user?.uiTheme ?? "DARK";
  const uiFontScale = user?.uiFontScale ?? "MEDIUM";

  return (
    <TenantThemeProvider uiTheme={uiTheme} uiFontScale={uiFontScale}>
      <TenantLightBrightness uiTheme={uiTheme} />
      {children}
    </TenantThemeProvider>
  );
}
