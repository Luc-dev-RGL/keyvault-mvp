// Nettoyage des anciennes entrees de demo (textes non accentues)
// Usage : bun scripts/clear-audit.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

await db.auditLog.deleteMany();
console.log("Journal d'audit purge");

await db.$disconnect();
