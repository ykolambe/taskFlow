import { redirect } from "next/navigation";

export default async function TenantRoot({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  redirect(`/t/${slug}/dashboard`);
}
