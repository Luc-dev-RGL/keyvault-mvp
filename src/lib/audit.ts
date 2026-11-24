import type { AuditAction } from "@prisma/client";
import { db } from "@/lib/db";

// Journal d'audit (spec 5.6) - ecriture seule, lecture via /api/audit
//
// Regles :
// - AUCUNE valeur de secret n'est jamais journalisee (spec 6.6, CA9) :
//   les details doivent rester synthetiques (action + cible, pas de contenu).
// - L'echec d'ecriture ne fait jamais echouer l'action metier : on journalise
//   l'erreur cote serveur sans contenu sensible.
interface AuditEntry {
  action: AuditAction;
  userId?: string | null;
  projectId?: string | null;
  detail?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        userId: entry.userId ?? null,
        projectId: entry.projectId ?? null,
        detail: entry.detail ?? "",
      },
    });
  } catch (error) {
    console.error("Échec de l'écriture du journal d'audit :", error);
  }
}
