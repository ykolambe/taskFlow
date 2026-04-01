import webpush from "web-push";
import type { PushSubscription as PrismaPushSubscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@localhost";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
    process.env.VAPID_PRIVATE_KEY?.trim()
  );
}

export type PushMessagePayload = {
  title: string;
  body: string;
  /** Same-origin path, e.g. /t/acme/dashboard */
  url: string;
  tag?: string;
};

function toWebPushSubscription(row: PrismaPushSubscription): webpush.PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function removeDeadEndpoint(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } }).catch(() => {});
}

/**
 * Send a Web Push to every stored subscription for these users. Prunes 404/410 endpoints.
 */
export async function sendWebPushToUserIds(
  userIds: string[],
  payload: PushMessagePayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid() || userIds.length === 0) return { sent: 0, failed: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...new Set(userIds)] } },
  });

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(toWebPushSubscription(sub), body, {
        TTL: 60 * 60 * 12,
      });
      sent++;
    } catch (err: unknown) {
      failed++;
      const status = typeof err === "object" && err && "statusCode" in err ? (err as { statusCode?: number }).statusCode : undefined;
      if (status === 404 || status === 410) {
        await removeDeadEndpoint(sub.endpoint);
      }
    }
  }

  return { sent, failed };
}

export async function sendWebPushToCompany(
  companyId: string,
  payload: PushMessagePayload
): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: { companyId, isActive: true },
    select: { id: true },
  });
  return sendWebPushToUserIds(
    users.map((u) => u.id),
    payload
  );
}

export async function sendWebPushToAllUsers(payload: PushMessagePayload): Promise<{ sent: number; failed: number }> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  return sendWebPushToUserIds(
    users.map((u) => u.id),
    payload
  );
}

export function buildTaskAssignedPayload(
  slug: string,
  taskTitle: string,
  assignerName: string,
  taskId: string
): PushMessagePayload {
  const path = `/t/${slug}/dashboard`;
  return {
    title: "New task assigned",
    body: `${assignerName}: ${taskTitle}`,
    url: path,
    tag: `task-${taskId}`,
  };
}

export async function dispatchDueScheduledPushes(): Promise<{ processed: number }> {
  if (!ensureVapid()) return { processed: 0 };

  const due = await prisma.scheduledPush.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: 25,
  });

  let processed = 0;

  for (const job of due) {
    const claimed = await prisma.scheduledPush.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    if (claimed.count !== 1) continue;

    try {
      let result: { sent: number; failed: number };
      const path = job.targetPath.startsWith("/") ? job.targetPath : `/${job.targetPath}`;
      const payload: PushMessagePayload = {
        title: job.title,
        body: job.body,
        url: path,
        tag: `scheduled-${job.id}`,
      };

      if (job.companyId) {
        result = await sendWebPushToCompany(job.companyId, payload);
      } else {
        result = await sendWebPushToAllUsers(payload);
      }

      await prisma.scheduledPush.update({
        where: { id: job.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          recipientCount: result.sent,
          errorMessage: result.failed > 0 ? `${result.failed} delivery failures` : null,
        },
      });
      processed++;
    } catch (e) {
      await prisma.scheduledPush.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          errorMessage: e instanceof Error ? e.message : String(e),
        },
      });
      processed++;
    }
  }

  return { processed };
}
