import { prisma } from "@vp/db";

// TEMP dev auth. Real auth (NextAuth or minimal JWT) is a later step — until
// then every request acts as a single seeded dev user so we can build and test
// the upload/transcode pipeline. Replace getCurrentUser() when auth lands.
export async function getCurrentUser() {
  const email = "dev@local.test";
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Dev User" },
  });
}
