import { redirect } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import ChatPageClient from "@/components/tenant/TeamChatPage";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({
    where: { slug },
  });
  if (!company || !company.isActive) redirect(`/t/${slug}/login`);

  return (
    <TenantLayout
      user={user}
      companyName={company.name}
      companyLogoUrl={company.logoUrl}
      slug={slug}
      modules={company.modules}
    >
      <ChatPageClient slug={slug} />
    </TenantLayout>
  );
}

