import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformUser } from "@/lib/auth";
import {
  createTenantWorkspace,
  CreateTenantValidationError,
  type RoleLevelInput,
} from "@/lib/tenantOnboarding";

export async function GET(req: NextRequest) {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, tasks: true } }, roleLevels: { orderBy: { level: "asc" } } },
  });

  return NextResponse.json({ success: true, data: companies });
}

export async function POST(req: NextRequest) {
  const user = await getPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name,
      slug,
      roleLevels,
      modules,
      geminiApiKeyPlatform,
      deploymentMode,
      dedicatedDatabase,
    } = body as {
      name?: string;
      slug?: string;
      roleLevels?: unknown;
      modules?: unknown;
      geminiApiKeyPlatform?: string;
      deploymentMode?: string;
      dedicatedDatabase?: {
        dbUrl?: string | null;
        dbHost?: string | null;
        dbPort?: number | string | null;
        dbName?: string | null;
        dbUserSecretRef?: string | null;
        dbPasswordSecretRef?: string | null;
        dbUrlSecretRef?: string | null;
      };
    };

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json({ error: "Slug can only contain lowercase letters, numbers, and hyphens" }, { status: 400 });
    }

    const existing = await prisma.company.findUnique({ where: { slug: String(slug).toLowerCase().trim() } });
    if (existing) {
      return NextResponse.json({ error: "This slug is already taken" }, { status: 409 });
    }

    const modeRaw = typeof deploymentMode === "string" ? deploymentMode.toUpperCase() : "SHARED";
    const mode = modeRaw === "DEDICATED" ? "DEDICATED" : "SHARED";

    const dd =
      mode === "DEDICATED" && dedicatedDatabase && typeof dedicatedDatabase === "object"
        ? (() => {
            const rawPort = dedicatedDatabase.dbPort;
            const n =
              rawPort === "" || rawPort === undefined || rawPort === null ? undefined : Number(rawPort);
            return {
              dbUrl: dedicatedDatabase.dbUrl ?? undefined,
              dbHost: dedicatedDatabase.dbHost ?? undefined,
              dbPort: n !== undefined && !Number.isNaN(n) ? n : undefined,
              dbName: dedicatedDatabase.dbName ?? undefined,
              dbUserSecretRef: dedicatedDatabase.dbUserSecretRef ?? undefined,
              dbPasswordSecretRef: dedicatedDatabase.dbPasswordSecretRef ?? undefined,
              dbUrlSecretRef: dedicatedDatabase.dbUrlSecretRef ?? undefined,
            };
          })()
        : undefined;

    const safeModules = Array.isArray(modules) ? (modules as string[]) : undefined;
    const safeRoleLevels = Array.isArray(roleLevels) ? (roleLevels as RoleLevelInput[]) : undefined;

    const result = await createTenantWorkspace({
      name,
      slug,
      modules: safeModules,
      roleLevels: safeRoleLevels,
      admin: { type: "platform_bootstrap" },
      req,
      provisioningJobSource: "company_create_auto",
      deploymentMode: mode,
      ...(dd ? { dedicatedDatabase: dd } : {}),
      ...(typeof geminiApiKeyPlatform === "string" && geminiApiKeyPlatform.trim()
        ? { geminiApiKeyPlatform: geminiApiKeyPlatform.trim() }
        : {}),
    });

    const normalizedSlug = result.normalizedSlug;

    return NextResponse.json({
      success: true,
      company: result.company,
      credentials: {
        email: result.credentials.email,
        password: result.credentials.password,
        slug: normalizedSlug,
      },
      provisioning: result.provisioning,
      secretRefs: result.secretRefs,
    });
  } catch (err: unknown) {
    if (err instanceof CreateTenantValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
