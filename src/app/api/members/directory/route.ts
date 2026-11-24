import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// GET /api/members/directory - annuaire des comptes actifs
// (superviseur ou admin). Necessaire pour l'ecran d'assignation des membres
// d'un projet : le superviseur doit pouvoir choisir parmi les comptes.
// Reponse minimale (id, nom, e-mail, role) : aucune donnee sensible.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }
  if (user.role !== "ADMIN" && user.role !== "SUPERVISOR") {
    return NextResponse.json(
      { error: "Droits insuffisants." },
      { status: 403 }
    );
  }

  const users = await db.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ users });
}
