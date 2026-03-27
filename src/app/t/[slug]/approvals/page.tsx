import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import ApprovalsPage from "@/components/tenant/ApprovalsPage";

const USER_SELECT = {
  id: true, firstName: true, lastName: true, email: true, username: true,
  avatarUrl: true, roleLevelId: true, roleLevel: true, isSuperAdmin: true,
};

export default async function ApprovalsServerPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  // Load all company users so the UI can resolve approverChain IDs to names
  const allUsers = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true },
    select: USER_SELECT,
  });

  // Build list of pending request IDs where it is the current user's turn
  let myTurnIds: string[] = [];
  if (!user.isSuperAdmin) {
    const allPending = await prisma.approvalRequest.findMany({
      where: { companyId: company.id, status: "PENDING" },
      select: { id: true, approverChain: true, approvals: { select: { approverId: true, status: true } } },
    });

    myTurnIds = allPending
      .filter((req) => {
        const chain = req.approverChain as string[];
        const approvedIds = new Set(
          req.approvals.filter((a) => a.status === "APPROVED").map((a) => a.approverId)
        );
        const next = chain.find((uid) => !approvedIds.has(uid));
        return next === user.userId;
      })
      .map((r) => r.id);
  }

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      companyId: company.id,
      ...(user.isSuperAdmin
        ? {}
        : {
            OR: [
              { requesterId: user.userId },
              { id: { in: myTurnIds } },
            ],
          }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: USER_SELECT },
      approvals: {
        include: { approver: { select: USER_SELECT } },
      },
    },
  });

  const pendingApprovals =
    user.isSuperAdmin || user.level <= 2
      ? await prisma.approvalRequest.count({ where: { companyId: company.id, status: "PENDING" } })
      : myTurnIds.length;

  return (
    <TenantLayout
      user={user}
      companyName={company.name}
      companyLogoUrl={company.logoUrl}
      slug={slug}
      modules={company.modules}
      pendingApprovals={pendingApprovals}
    >
      <ApprovalsPage
        currentUser={user}
        approvals={approvals as any}
        slug={slug}
        companyId={company.id}
        allUsers={allUsers as any}
      />
    </TenantLayout>
  );
}
