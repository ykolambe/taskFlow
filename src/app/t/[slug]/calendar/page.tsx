import { redirect, notFound } from "next/navigation";
import { getTenantUserFresh } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TenantLayout from "@/components/layout/TenantLayout";
import CalendarView from "@/components/tenant/CalendarView";
import { countPendingApprovalsForUser } from "@/lib/approvalRequestCounts";

const USER_SELECT = {
  id: true, firstName: true, lastName: true, avatarUrl: true,
  roleLevelId: true, roleLevel: true, email: true, username: true, isSuperAdmin: true,
};

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company || !company.isActive) notFound();

  // Compute visible subtree
  const allUsers = await prisma.user.findMany({
    where: {
      companyId: company.id,
      isActive: true,
      OR: [{ id: user.userId }, { isTenantBootstrapAccount: false }],
    },
    select: { id: true, parentId: true },
  });

  function getSubtreeIds(userId: string): string[] {
    const children = allUsers.filter((u) => u.parentId === userId).map((u) => u.id);
    return [userId, ...children.flatMap((id) => getSubtreeIds(id))];
  }
  const visibleUserIds = getSubtreeIds(user.userId);

  // Fetch tasks with due dates visible to this user
  const tasks = await prisma.task.findMany({
    where: {
      companyId: company.id,
      assigneeId: { in: visibleUserIds },
      isArchived: false,
      dueDate: { not: null },
    },
    orderBy: { dueDate: "asc" },
    include: {
      creator: { select: USER_SELECT },
      assignee: { select: USER_SELECT },
    },
  });

  // Fetch active recurring tasks visible to this user
  const recurringTasks = await prisma.recurringTask.findMany({
    where: {
      companyId: company.id,
      assigneeId: { in: visibleUserIds },
      isActive: true,
    },
    include: {
      creator: { select: USER_SELECT },
      assignee: { select: USER_SELECT },
    },
  });

  // Ensure there is always one org calendar.
  await prisma.calendarCollection.upsert({
    where: { id: `${company.id}-org` },
    update: {},
    create: {
      id: `${company.id}-org`,
      companyId: company.id,
      ownerUserId: null,
      name: "Org Calendar",
      color: "#22c55e",
      type: "ORG",
    },
  });

  const calendars = await prisma.calendarCollection.findMany({
    where: {
      companyId: company.id,
      isArchived: false,
      OR: [{ type: "ORG" }, { ownerUserId: user.userId }],
    },
    orderBy: [{ type: "asc" }, { createdAt: "asc" }],
  });

  const calendarEntries = await prisma.calendarEntry.findMany({
    where: {
      companyId: company.id,
      calendarId: { in: calendars.map((c) => c.id) },
    },
    orderBy: { startAt: "asc" },
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
      <CalendarView
        user={user}
        tasks={tasks as any}
        recurringTasks={recurringTasks as any}
        calendars={calendars as any}
        calendarEntries={calendarEntries as any}
        slug={slug}
      />
    </TenantLayout>
  );
}
