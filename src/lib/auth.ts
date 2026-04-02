import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UiFontScale, UiTheme } from "@prisma/client";
import { hydrateTenantPrisma, prisma, setTenantDbContext } from "@/lib/prisma";
import { getJwtExpirationDurationString } from "@/lib/sessionDuration";

const getSecret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET || "fallback-dev-secret-please-change"
  );

// ─── Token Types ──────────────────────────────────────────────────────────

export interface PlatformTokenPayload {
  type: "platform";
  id: string;
  email: string;
  name: string;
}

export interface TenantTokenPayload {
  type: "tenant";
  userId: string;
  companyId: string;
  companySlug: string;
  roleLevelId: string | null;
  level: number;       // 0 = super admin outside hierarchy; higher = lower in org
  isSuperAdmin: boolean;
  firstName: string;
  lastName: string;
  email: string;
  /** Per-user add-on grants (refreshed in getTenantUserFresh from DB) */
  chatAddonAccess?: boolean;
  recurringAddonAccess?: boolean;
  aiAddonAccess?: boolean;
  contentStudioAddonAccess?: boolean;
}

export type TokenPayload = PlatformTokenPayload | TenantTokenPayload;

// ─── Sign / Verify ────────────────────────────────────────────────────────

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(getJwtExpirationDurationString())
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), { clockTolerance: 120 });
  return payload as unknown as TokenPayload;
}

// ─── Cookie Helpers ───────────────────────────────────────────────────────

export function getPlatformCookieName() {
  return "platform_token";
}

export function getTenantCookieName(slug: string) {
  return `tenant_${slug}_token`;
}

// ─── Server-side Auth Helpers ─────────────────────────────────────────────

export async function getPlatformUser(): Promise<PlatformTokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getPlatformCookieName())?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (payload.type !== "platform") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getTenantUser(
  slug: string
): Promise<TenantTokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(getTenantCookieName(slug))?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (payload.type !== "tenant") return null;
    setTenantDbContext({ companyId: payload.companyId, slug: payload.companySlug });
    await hydrateTenantPrisma(payload.companyId);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Like getTenantUser but overlays fresh firstName/lastName/email/avatarUrl
 * from the database so profile updates are reflected immediately without
 * requiring a re-login.
 */
export async function getTenantUserFresh(
  slug: string
): Promise<
  | (TenantTokenPayload & {
      avatarUrl: string | null;
      uiTheme: UiTheme;
      uiFontScale: UiFontScale;
    })
  | null
> {
  const token = await getTenantUser(slug);
  if (!token) return null;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        isSuperAdmin: true,
        chatAddonAccess: true,
        recurringAddonAccess: true,
        aiAddonAccess: true,
        contentStudioAddonAccess: true,
        uiTheme: true,
        uiFontScale: true,
      },
    });
    if (!dbUser) return null;

    return {
      ...token,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      email: dbUser.email,
      avatarUrl: dbUser.avatarUrl ?? null,
      isSuperAdmin: Boolean(dbUser.isSuperAdmin),
        chatAddonAccess: dbUser.chatAddonAccess,
        recurringAddonAccess: dbUser.recurringAddonAccess,
        aiAddonAccess: dbUser.aiAddonAccess,
        contentStudioAddonAccess: dbUser.contentStudioAddonAccess,
      uiTheme: dbUser.uiTheme,
      uiFontScale: dbUser.uiFontScale,
    };
  } catch {
    return {
      ...token,
      avatarUrl: null,
      uiTheme: "DARK" as UiTheme,
      uiFontScale: "MEDIUM" as UiFontScale,
    };
  }
}
