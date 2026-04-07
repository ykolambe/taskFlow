/**
 * Create or update the platform admin user (PlatformOwner).
 * Run on the server when /platform/login fails with "Invalid credentials" after deploy:
 *
 *   cd /path/to/app && export $(grep -v '^#' .env | xargs) && npm run db:platform-owner
 *
 * Uses PLATFORM_EMAIL, PLATFORM_PASSWORD, PLATFORM_NAME from env (same defaults as prisma/seed.ts).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.PLATFORM_EMAIL || "admin@platform.com").trim().toLowerCase();
  const password = process.env.PLATFORM_PASSWORD || "Platform@123";
  const name = process.env.PLATFORM_NAME || "Platform Admin";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.platformOwner.upsert({
    where: { email },
    create: { email, passwordHash, name },
    update: { passwordHash, name },
  });

  console.log(`Platform owner ready. Log in at /platform/login with email: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
