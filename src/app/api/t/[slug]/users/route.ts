import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePassword } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { canAddSeat } from "@/lib/planEntitlements";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [users, reportingLinks] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: company.id, isActive: true, isTenantBootstrapAccount: false },
      include: {
        roleLevel: true,
        reportingLinksAsSubordinate: { select: { managerId: true, sortOrder: true } },
      },
      orderBy: [{ firstName: "asc" }],
    }),
    prisma.userReportingLink.findMany({
      where: { companyId: company.id },
      select: { subordinateId: true, managerId: true, sortOrder: true },
    }),
  ]);
  users.sort((a, b) => {
    const la = a.roleLevel?.level ?? -1;
    const lb = b.roleLevel?.level ?? -1;
    if (la !== lb) return la - lb;
    return a.firstName.localeCompare(b.firstName);
  });

  return NextResponse.json({ success: true, data: users, reportingLinks });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const currentUser = await getTenantUser(slug);
  if (!currentUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!currentUser.isSuperAdmin && currentUser.level > 1) {
    return NextResponse.json({ error: "You don't have permission to add users directly" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { firstName, lastName, email, username, roleLevelId } = body;
    const managerIds: string[] = Array.isArray(body.managerIds)
      ? body.managerIds.filter((x: unknown) => typeof x === "string")
      : typeof body.parentId === "string" && body.parentId
        ? [body.parentId]
        : [];

    if (!firstName || !lastName || !email || !roleLevelId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const emailNorm = email.toLowerCase();
    const existing = await prisma.user.findFirst({ where: { email: emailNorm, companyId: company.id } });

    if (existing?.isActive) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const seatCheck = await canAddSeat(company.id);
    if (!seatCheck.ok) {
      return NextResponse.json({ error: seatCheck.reason }, { status: 403 });
    }

    const password = generatePassword(12);

    /** Same email as a deactivated member — reactivate instead of inserting a duplicate row. */
    if (existing && !existing.isActive) {
      if (existing.isTenantBootstrapAccount) {
        return NextResponse.json(
          { error: "This email is reserved for the workspace bootstrap account." },
          { status: 409 }
        );
      }

      let finalUsername =
        typeof username === "string" && username.trim() ? username.trim() : existing.username;
      const usernameConflict = await prisma.user.findFirst({
        where: { companyId: company.id, username: finalUsername, NOT: { id: existing.id } },
      });
      if (usernameConflict) {
        finalUsername = `${firstName.toLowerCase().replace(/\s+/g, "")}${Math.floor(Math.random() * 10000)}`;
      }

      const reactivated = await prisma.$transaction(async (tx) => {
        await tx.userReportingLink.deleteMany({ where: { subordinateId: existing.id } });
        const u = await tx.user.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            roleLevelId,
            email: emailNorm,
            username: finalUsername,
            passwordHash: await bcrypt.hash(password, 12),
            firstName,
            lastName,
          },
          include: { roleLevel: true },
        });
        for (let i = 0; i < managerIds.length; i++) {
          await tx.userReportingLink.create({
            data: {
              companyId: company.id,
              subordinateId: u.id,
              managerId: managerIds[i],
              sortOrder: i,
            },
          });
        }
        return u;
      });

      return NextResponse.json({
        success: true,
        data: reactivated,
        credentials: { email: reactivated.email, password, username: finalUsername },
        reactivated: true,
      });
    }

    const finalUsername = username || `${firstName.toLowerCase()}${Math.floor(Math.random() * 1000)}`;

    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          companyId: company.id,
          roleLevelId,
          email: emailNorm,
          username: finalUsername,
          passwordHash: await bcrypt.hash(password, 12),
          firstName,
          lastName,
        },
        include: { roleLevel: true },
      });
      for (let i = 0; i < managerIds.length; i++) {
        await tx.userReportingLink.create({
          data: {
            companyId: company.id,
            subordinateId: u.id,
            managerId: managerIds[i],
            sortOrder: i,
          },
        });
      }
      return u;
    });

    return NextResponse.json({
      success: true,
      data: newUser,
      credentials: { email: newUser.email, password, username: finalUsername },
    });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
