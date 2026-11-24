import { NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// POST /api/auth/logout - deconnexion (spec 9)
// L'action est journalisee si une session valide existait.
export async function POST() {
  const user = await getSessionUser();
  if (user) {
    await logAudit({
      action: "AUTH_LOGOUT",
      userId: user.id,
      detail: "Déconnexion",
    });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
