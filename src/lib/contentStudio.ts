import type { CalendarMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPaidSubscriptionAccessOk } from "@/lib/planEntitlements";

const ROLE_RANK: Record<CalendarMemberRole, number> = {
  VIEW: 1,
  EDIT: 2,
  PUBLISH: 3,
  ADMIN: 4,
};

export async function isContentStudioEnabledForUser(companyId: string, userId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      modules: true,
      billing: {
        select: {
          contentStudioAddonEnabled: true,
          plan: true,
          subscriptionStatus: true,
          subscriptionCurrentPeriodEnd: true,
        },
      },
    },
  });
  if (!company) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { contentStudioAddonAccess: true },
  });
  if (!user?.contentStudioAddonAccess) return false;

  const billingOk =
    company.modules.includes("content") || Boolean(company.billing?.contentStudioAddonEnabled);
  if (!billingOk) return false;
  if (company.billing && !isPaidSubscriptionAccessOk(company.billing)) return false;
  return true;
}

export async function getCalendarMemberRole(
  calendarId: string,
  userId: string
): Promise<CalendarMemberRole | null> {
  const row = await prisma.calendarMember.findUnique({
    where: { calendarId_userId: { calendarId, userId } },
    select: { role: true },
  });
  return row?.role ?? null;
}

/** Super admin OR explicit calendar member with at least minRole. If no members on calendar, any content user with EDIT-equivalent via company (open access). */
export async function canAccessCalendar(
  calendarId: string,
  companyId: string,
  userId: string,
  isSuperAdmin: boolean,
  minRole: CalendarMemberRole
): Promise<boolean> {
  if (isSuperAdmin) return true;

  const cal = await prisma.calendarCollection.findFirst({
    where: { id: calendarId, companyId, isArchived: false },
  });
  if (!cal) return false;

  const memberCount = await prisma.calendarMember.count({ where: { calendarId } });
  const role = await getCalendarMemberRole(calendarId, userId);

  if (memberCount === 0) {
    return (
      (await isContentStudioEnabledForUser(companyId, userId)) &&
      ROLE_RANK[minRole] <= ROLE_RANK.EDIT
    );
  }

  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export async function canEditContentEntry(
  calendarId: string,
  companyId: string,
  userId: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  return canAccessCalendar(calendarId, companyId, userId, isSuperAdmin, "EDIT");
}

export async function canPublishContent(
  calendarId: string,
  companyId: string,
  userId: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  return canAccessCalendar(calendarId, companyId, userId, isSuperAdmin, "PUBLISH");
}

export async function canManageCalendarMembers(
  calendarId: string,
  companyId: string,
  userId: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true;
  const memberCount = await prisma.calendarMember.count({ where: { calendarId } });
  const role = await getCalendarMemberRole(calendarId, userId);
  if (role === "ADMIN") return true;
  if (memberCount === 0) {
    const u = await prisma.user.findFirst({
      where: { id: userId, companyId },
      include: { roleLevel: true },
    });
    if (u?.roleLevel?.level === 1) return true;
  }
  return false;
}
