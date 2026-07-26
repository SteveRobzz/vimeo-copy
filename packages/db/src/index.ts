import { PrismaClient } from "@prisma/client";

// Reuse a single client across hot-reloads (Next dev) and across imports.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export generated types + enums (Privacy, VideoStatus, model types)
// so both the web app and the worker import them from one place.
export * from "@prisma/client";
