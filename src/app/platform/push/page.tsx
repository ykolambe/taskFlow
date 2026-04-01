import { redirect } from "next/navigation";
import { getPlatformUser } from "@/lib/auth";
import PlatformLayout from "@/components/layout/PlatformLayout";
import PlatformScheduledPushClient from "@/components/platform/PlatformScheduledPushClient";

export default async function PlatformPushPage() {
  const user = await getPlatformUser();
  if (!user) redirect("/platform/login");

  return (
    <PlatformLayout user={user}>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <p className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-1">Platform</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-surface-50 mb-1">Scheduled push broadcasts</h1>
        <p className="text-surface-500 text-sm mb-6">
          Schedule Web Push messages to tenant users who opted in. Requires VAPID keys on the server and a cron hitting{" "}
          <code className="text-[11px] bg-surface-800 px-1 rounded">/api/cron/push-scheduled</code>.
        </p>
        <PlatformScheduledPushClient />
      </div>
    </PlatformLayout>
  );
}
