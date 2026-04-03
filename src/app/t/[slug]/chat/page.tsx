import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { isUserAiEnabled } from "@/lib/ai/entitlement";
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

  const viewerRow = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { aiLeaderQaEnabled: true },
  });
  const showLeaderGptInChat =
    Boolean(viewerRow?.aiLeaderQaEnabled) && (await isUserAiEnabled(company.id, user.userId));

  return (
    <TenantLayout
      user={user}
      companyName={company.name}
      companyLogoUrl={company.logoUrl}
      slug={slug}
      modules={company.modules}
    >
      <div className="h-[calc(100dvh-7.25rem)] lg:h-[calc(100dvh-1.5rem)] overflow-hidden flex flex-col min-h-0">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center bg-surface-950 text-slate-500 dark:bg-[#13101c] dark:text-[#9ca0b8] text-sm">
              Loading chats…
            </div>
          }
        >
          <ChatPageClient
            slug={slug}
            currentUserId={user.userId}
            showLeaderGptInChat={showLeaderGptInChat}
          />
        </Suspense>
      </div>
    </TenantLayout>
  );
}

