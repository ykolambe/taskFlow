import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import ContentStudioView from "@/components/tenant/ContentStudioView";
import { isContentStudioEnabledForUser } from "@/lib/contentStudio";
import { isUserAiEnabled } from "@/lib/ai/entitlement";
import { countPendingApprovalsForUser } from "@/lib/approvalRequestCounts";

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  roleLevelId: true,
  roleLevel: true,
  email: true,
  username: true,
  isSuperAdmin: true,
} as const;

export default async function ContentStudioPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  const entitled = await isContentStudioEnabledForUser(company.id, user.userId);
  if (!entitled) redirect(`/t/${slug}/dashboard`);

  const aiEnabled = await isUserAiEnabled(company.id, user.userId);

  const [companyUsers, channelCalendars] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: company.id, isActive: true, isTenantBootstrapAccount: false },
      select: USER_SELECT,
      orderBy: [{ firstName: "asc" }],
    }),
    prisma.calendarCollection.findMany({
      where: { companyId: company.id, type: "CHANNEL", isArchived: false },
      include: {
        members: { include: { user: { select: USER_SELECT } } },
        entries: {
          where: { kind: "CONTENT" },
          orderBy: { startAt: "desc" },
          include: {
            assignee: { select: USER_SELECT },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const visibleCalendars = channelCalendars.filter((c) => {
    if (c.members.length === 0) return true;
    return c.members.some((m) => m.userId === user.userId);
  });

  const pendingApprovals = await countPendingApprovalsForUser(company.id, user.userId);

  return (
    <TenantLayout
      user={user}
      companyName={company.name}
      companyLogoUrl={company.logoUrl}
      slug={slug}
      modules={company.modules}
      pendingApprovals={pendingApprovals}
    >
      <ContentStudioView
        slug={slug}
        user={user}
        companyUsers={JSON.parse(JSON.stringify(companyUsers))}
        initialCalendars={JSON.parse(JSON.stringify(visibleCalendars))}
        aiEnabled={aiEnabled}
      />
    </TenantLayout>
  );
}
