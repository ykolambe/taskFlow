import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import ApprovalsPage from "@/components/tenant/ApprovalsPage";
import { getNextRequiredApprover } from "@/lib/approvalChain";

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

  const allPendingForTurn = await prisma.approvalRequest.findMany({
    where: { companyId: company.id, status: "PENDING" },
    select: {
      id: true,
      requesterId: true,
      approverChain: true,
      approvals: { select: { approverId: true, status: true } },
    },
  });

  const myTurnIds = allPendingForTurn
    .filter((req) => {
      const chain = req.approverChain as string[];
      const next = getNextRequiredApprover(chain, req.approvals);
      const turn = chain.length === 0 ? req.requesterId : next;
      return turn === user.userId;
    })
    .map((r) => r.id);

  const approvals = await prisma.approvalRequest.findMany({
    where: {
      companyId: company.id,
      OR: [{ requesterId: user.userId }, { id: { in: myTurnIds } }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: USER_SELECT },
      approvals: {
        include: { approver: { select: USER_SELECT } },
      },
    },
  });

  const pendingApprovals = myTurnIds.length;

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
