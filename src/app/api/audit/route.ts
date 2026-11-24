import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// GET /api/audit - journal d'audit (spec 5.6, 9)
// Visibilite :
// - ADMIN     -> tout le journal
// - SUPERVISEUR -> les entrees liees aux projets qu'il supervise
// - MEMBRE    -> 403 : il consulte son historique via Mon activite
// Lecture seule : aucune route d'ecriture n'existe sur le journal (spec 6.8).

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  if (user.role === "MEMBER") {
    return NextResponse.json(
      { error: "Consultez votre activité personnelle dans Mon espace." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const projectIdFilter = url.searchParams.get("projectId") ?? undefined;
  const limitParam = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 200)
    : 100;

  let where = {};
  if (user.role === "SUPERVISOR") {
    // Les entrees liees aux projets qu'il supervise uniquement
    const supervised = await db.project.findMany({
      where: { supervisorId: user.id },
      select: { id: true },
    });
    const supervisedIds = supervised.map((p) => p.id);
    where = {
      projectId: projectIdFilter
        ? projectIdFilter
        : { in: supervisedIds.length > 0 ? supervisedIds : ["_aucun_"] },
    };
  } else if (projectIdFilter) {
    where = { projectId: projectIdFilter };
  }

  const entries = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      detail: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ entries });
}
