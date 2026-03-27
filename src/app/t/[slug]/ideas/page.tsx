import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import IdeaBoard from "@/components/tenant/IdeaBoard";

export default async function IdeasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  // Fetch this user's ideas
  const ideas = await prisma.idea.findMany({
    where: { companyId: company.id, userId: user.userId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  // Fetch assignable users for the convert-to-task modal
  const allUsers = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true },
    include: { roleLevel: true },
    orderBy: { firstName: "asc" },
  });
  const currentUserData = allUsers.find((u) => u.id === user.userId);
  const currentLevel = currentUserData?.roleLevel?.level ?? 0;
  const assignableUsers = allUsers.filter(
    (u) => (u.roleLevel?.level ?? 0) >= currentLevel
  );

  const pendingApprovals = await prisma.approvalRequest.count({
    where: {
      companyId: company.id,
      status: "PENDING",
      approverChain: { array_contains: user.userId },
    },
  });

  return (
    <TenantLayout
      user={user}
      companyName={company.name}
      companyLogoUrl={company.logoUrl}
      slug={slug}
      modules={company.modules}
      pendingApprovals={pendingApprovals}
    >
      <IdeaBoard
        user={user}
        slug={slug}
        initialIdeas={ideas as any}
        assignableUsers={assignableUsers as any}
      />
    </TenantLayout>
  );
}
