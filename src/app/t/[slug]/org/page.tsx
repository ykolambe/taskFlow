import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import OrgChart from "@/components/tenant/OrgChart";

export default async function OrgChartPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  const allUsers = await prisma.user.findMany({
    where: { companyId: company.id, isActive: true },
    include: { roleLevel: true },
    orderBy: { firstName: "asc" },
  });

  allUsers.sort((a, b) => {
    const la = a.roleLevel?.level ?? 999;
    const lb = b.roleLevel?.level ?? 999;
    if (la !== lb) return la - lb;
    return a.firstName.localeCompare(b.firstName);
  });

  const fallbackRoleLevel = {
    id: "__none__",
    name: "—",
    level: 999,
    color: "#64748b",
    companyId: company.id,
    canApprove: false,
  };

  const superAdminOnlyUsers = allUsers.filter((u) => u.isSuperAdmin && !u.roleLevelId);
  const superAdminOnlyIds = new Set(superAdminOnlyUsers.map((u) => u.id));
  const mainHierarchyUsers = allUsers.filter((u) => !superAdminOnlyIds.has(u.id));

  function toOrgNode(u: (typeof allUsers)[number]) {
    const rl = u.roleLevel;
    const roleLevel = rl
      ? {
          id: rl.id,
          name: rl.name,
          level: rl.level,
          color: rl.color,
          companyId: u.companyId,
          canApprove: rl.canApprove,
        }
      : fallbackRoleLevel;
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      avatarUrl: u.avatarUrl,
      isSuperAdmin: u.isSuperAdmin,
      isActive: u.isActive,
      roleLevel,
    };
  }

  // Build main tree (excluding super admins from chain; director stays directly below org).
  function buildTree(parentId: string | null): any[] {
    return mainHierarchyUsers
      .filter((u) => {
        const normalizedParentId = u.parentId && superAdminOnlyIds.has(u.parentId) ? null : u.parentId;
        return normalizedParentId === parentId;
      })
      .map((u) => {
        return {
          ...toOrgNode(u),
          children: buildTree(u.id),
        };
      });
  }

  const orgTree = buildTree(null);
  const superAdmins = superAdminOnlyUsers
    .map((u) => ({ ...toOrgNode(u), children: [] }));

  const pendingApprovals = user.level <= 2
    ? await prisma.approvalRequest.count({ where: { companyId: company.id, status: "PENDING" } })
    : 0;

  return (
    <TenantLayout user={user} companyName={company.name} companyLogoUrl={company.logoUrl} slug={slug} modules={company.modules} pendingApprovals={pendingApprovals}>
      <OrgChart
        orgTree={orgTree}
        superAdmins={superAdmins}
        currentUserId={user.userId}
        companyName={company.name}
        companyLogoUrl={company.logoUrl}
        slug={slug}
      />
    </TenantLayout>
  );
}
