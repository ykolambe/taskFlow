import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import ProfilePage from "@/components/tenant/ProfilePage";
import { countPendingApprovalsForUser } from "@/lib/approvalRequestCounts";

export default async function ProfileServerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    include: { roleLevel: true },
  });
  if (!dbUser) redirect(`/t/${slug}/login`);

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
      <ProfilePage
        user={user}
        slug={slug}
        initialData={{
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          email: dbUser.email,
          username: dbUser.username,
          avatarUrl: dbUser.avatarUrl,
          bio: dbUser.bio,
          phone: dbUser.phone,
          roleLevel: dbUser.roleLevel
            ? {
                name: dbUser.roleLevel.name,
                color: dbUser.roleLevel.color,
                level: dbUser.roleLevel.level,
              }
            : { name: "—", color: "#64748b", level: 0 },
          isSuperAdmin: dbUser.isSuperAdmin,
        }}
      />
    </TenantLayout>
  );
}
