import { PrismaClient } from "@prisma/client";

// Singleton Prisma partage par toute l'application.
// Le stockage sur globalThis evite de multiplier les connexions PostgreSQL
// pendant le hot-reload en development (le module est recharge a chaque
// modification, mais le client, lui, est conserve).
//
// Niveau de log volontairement limite a warn/error : le log "query"
// afficherait des donnees potentiellement sensibles, ce que la spec
// interdit (section 6.6 - pas de secrets dans les logs).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
