import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { bcPrisma?: PrismaClient };
export const db = globalDb.bcPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.bcPrisma = db;
