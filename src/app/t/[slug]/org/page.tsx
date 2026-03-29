import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import OrgChart from "@/components/tenant/OrgChart";
import { countPendingApprovalsForUser } from "@/lib/approvalRequestCounts";

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

  // Load all active users (including bootstrap) so parentId chains resolve. Bootstrap
  // accounts are hidden from the chart but their reports must attach at the root.
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
  const mainHierarchyUsers = allUsers.filter(
    (u) => !superAdminOnlyIds.has(u.id) && !u.isTenantBootstrapAccount
  );

  const mainHierarchyIdSet = new Set(mainHierarchyUsers.map((u) => u.id));

  /** Parent for tree edges: root if no parent, or parent not in the drawable org tree (bootstrap / super-only / missing flag). */
  function effectiveParentId(u: (typeof allUsers)[number]): string | null {
    const p = u.parentId;
    if (!p) return null;
    const parent = allUsers.find((x) => x.id === p);
    if (!parent) return null;
    if (parent.isTenantBootstrapAccount) return null;
    if (parent.isSuperAdmin && !parent.roleLevelId) return null;
    if (!mainHierarchyIdSet.has(p)) return null;
    return p;
  }

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

  // Build main tree: edges only between drawable nodes; reports of hidden parents attach at root.
  function buildTree(parentId: string | null): any[] {
    return mainHierarchyUsers
      .filter((u) => effectiveParentId(u) === parentId)
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

  const pendingApprovals = await countPendingApprovalsForUser(company.id, user.userId);

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
