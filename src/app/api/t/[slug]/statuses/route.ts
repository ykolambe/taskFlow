import { NextRequest, NextResponse } from "next/server";
import { getTenantUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const statuses = await prisma.taskStatusConfig.findMany({
    where: { companyId: company.id },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ success: true, data: statuses });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user?.isSuperAdmin) return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { label, color, type } = await req.json();
  if (!label?.trim()) return NextResponse.json({ error: "Label is required" }, { status: 400 });
  if (!["OPEN", "ACTIVE", "REVIEW", "DONE"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  // Enforce: only one OPEN and one DONE
  if (type === "OPEN" || type === "DONE") {
    const existing = await prisma.taskStatusConfig.findFirst({
      where: { companyId: company.id, type },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A status of type "${type}" already exists. Only one is allowed.` },
        { status: 409 }
      );
    }
  }

  // Generate a URL-safe key from the label
  const baseKey = label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  let key = baseKey;
  let suffix = 1;
  while (await prisma.taskStatusConfig.findUnique({ where: { companyId_key: { companyId: company.id, key } } })) {
    key = `${baseKey}_${suffix++}`;
  }

  // Place at the end (before DONE) or last
  const maxOrder = await prisma.taskStatusConfig.aggregate({
    where: { companyId: company.id },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? 0) + 1;

  const status = await prisma.taskStatusConfig.create({
    data: { companyId: company.id, key, label: label.trim(), color: color || "#64748b", order, type },
  });

  return NextResponse.json({ success: true, data: status });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const user = await getTenantUser(slug);
  if (!user?.isSuperAdmin) return NextResponse.json({ error: "Super admin only" }, { status: 403 });

  const company = await prisma.company.findUnique({ where: { slug } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Accepts an array of { id, label, color, order } — bulk update (for reorder + rename)
  const { statuses } = await req.json();
  if (!Array.isArray(statuses)) return NextResponse.json({ error: "statuses array required" }, { status: 400 });

  for (const s of statuses) {
    if (!s.id) continue;
    await prisma.taskStatusConfig.updateMany({
      where: { id: s.id, companyId: company.id },
      data: {
        ...(s.label !== undefined && { label: s.label }),
        ...(s.color !== undefined && { color: s.color }),
        ...(s.order !== undefined && { order: s.order }),
      },
    });
  }

  const updated = await prisma.taskStatusConfig.findMany({
    where: { companyId: company.id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ success: true, data: updated });
}
