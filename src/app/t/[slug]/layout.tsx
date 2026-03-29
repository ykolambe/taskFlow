import type { Metadata } from "next";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

/** Per-slug manifest so Add to Home Screen / install uses this workspace start_url + scope. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    manifest: `/t/${slug}/manifest`,
  };
}

// Pass-through layout — each page handles its own auth and layout
export default function TenantRootLayout({ children }: Props) {
  return <>{children}</>;
}
