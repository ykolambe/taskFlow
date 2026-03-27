import { redirect } from "next/navigation";
import { getPlatformUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PlatformLayout from "@/components/layout/PlatformLayout";
import CompanyList from "@/components/platform/CompanyList";

export default async function CompaniesPage() {
  const user = await getPlatformUser();
  if (!user) redirect("/platform/login");

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, tasks: true } },
      roleLevels: { orderBy: { level: "asc" } },
    },
  });

  return (
    <PlatformLayout user={user}>
      <CompanyList companies={companies} />
    </PlatformLayout>
  );
}
