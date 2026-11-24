import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// GET /api/me/activity - historique personnel (spec 5.5)
// Les 50 dernieres actions de l'utilisateur connecte, la plus recente
// d'abord. Les entrees sont en lecture seule : aucune route d'ecriture
// n'existe sur le journal (spec 6.8).
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  const entries = await db.auditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      detail: true,
      createdAt: true,
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ entries });
}
