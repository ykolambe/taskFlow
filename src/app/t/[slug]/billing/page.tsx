import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getTenantUserFresh } from "@/lib/auth";
import TenantLayout from "@/components/layout/TenantLayout";
import { CreditCard, Building2, Users, CheckSquare, Lightbulb, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function TenantBillingPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;

  const user = await getTenantUserFresh(slug);
  if (!user) redirect(`/t/${slug}/login`);
  if (!user.isSuperAdmin) redirect(`/t/${slug}/dashboard`);

  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      billing: true,
      _count: { select: { users: true, tasks: true, ideas: true, recurringTasks: true } },
    },
  });

  if (!company || !company.isActive) notFound();

  const config = await prisma.billingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const pricePerSeat = company.billing?.pricePerSeat ?? config.defaultPricePerSeat;
  const seats = company._count.users;
  const seatsLimit = company.billing?.seatsLimit ?? null;
  const effectivePlan = company.billing?.plan ?? "FREE";
  const billingCycle = config.billingCycle;

  const estimatedMRR =
    billingCycle === "annual" ? (pricePerSeat * seats * 12) / 12 : pricePerSeat * seats;

  const seatsUsedPct =
    seatsLimit && seatsLimit > 0 ? Math.min(100, Math.round((seats / seatsLimit) * 100)) : null;

  const nextBillingFrequencyLabel = billingCycle === "annual" ? "annualized to monthly" : "monthly";

  return (
    <TenantLayout user={user} companyName={company.name} companyLogoUrl={company.logoUrl} slug={slug} modules={company.modules}>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-widest mb-1">Billing</p>
            <h1 className="text-2xl font-bold text-surface-100 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary-400" />
              Usage & Plan
            </h1>
            <p className="text-sm text-surface-400 mt-1">
              Per-seat pricing is configured by the platform owner. You can view effective pricing here.
            </p>
          </div>
          <div className="hidden sm:block">
            <span className="text-xs bg-primary-500/10 text-primary-300 border border-primary-500/25 px-2.5 py-1 rounded-full font-semibold">
              {effectivePlan}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="Est. MRR"
            value={formatCurrency(estimatedMRR, config.currency)}
            subtitle={nextBillingFrequencyLabel}
            icon={<CreditCard className="w-4 h-4" />}
            color="success"
          />
          <StatCard
            title="Seats"
            value={`${seats}`}
            subtitle={seatsLimit ? `Limit ${seatsLimit}` : "Unlimited"}
            icon={<Users className="w-4 h-4" />}
            color="info"
          />
          <StatCard
            title="Tasks"
            value={`${company._count.tasks}`}
            subtitle="Total created"
            icon={<CheckSquare className="w-4 h-4" />}
            color="warning"
          />
          <StatCard
            title="Ideas"
            value={`${company._count.ideas}`}
            subtitle="Logged ideas"
            icon={<Lightbulb className="w-4 h-4" />}
            color="primary"
          />
        </div>

        {seatsLimit && (
          <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-surface-100">Seat usage</p>
              <p className="text-xs text-surface-400">
                {seats} / {seatsLimit} ({seatsUsedPct ?? 0}%)
              </p>
            </div>
            <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${seatsUsedPct ?? 0}%` }}
              />
            </div>
            {seatsUsedPct !== null && seatsUsedPct >= 90 && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4" />
                You are close to the seat limit. Ask the platform owner to increase seats.
              </div>
            )}
          </div>
        )}

        <div className="bg-surface-800 border border-surface-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary-400" />
            <p className="text-sm font-semibold text-surface-100">Effective pricing</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-surface-500 font-semibold uppercase tracking-widest">Plan</p>
              <p className="text-surface-200 font-semibold">{effectivePlan}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500 font-semibold uppercase tracking-widest">Price / Seat</p>
              <p className="text-surface-200 font-semibold">
                {formatCurrency(pricePerSeat, config.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-500 font-semibold uppercase tracking-widest">Seats limit</p>
              <p className="text-surface-200 font-semibold">{seatsLimit ?? "Unlimited"}</p>
            </div>
            <div>
              <p className="text-xs text-surface-500 font-semibold uppercase tracking-widest">Billing cycle</p>
              <p className="text-surface-200 font-semibold">{billingCycle}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-surface-700/50">
            <p className="text-xs text-surface-500">
              Last updated: {config.updatedAt ? formatDate(config.updatedAt) : "—"}
            </p>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}

