import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: databaseUrl
      ? {
          db: { url: databaseUrl },
        }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
