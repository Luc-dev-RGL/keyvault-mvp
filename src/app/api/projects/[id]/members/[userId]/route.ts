import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";

// DELETE /api/projects/:id/members/:userId - retirer un membre du projet
// (superviseur du projet ou admin, spec 9). Le retrait revoque
// immediatement l'acces du membre : sa prochaine requete est refusee (5.3).

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  const { id, userId } = await params;
  const access = await getProjectAccess(user, id);
  if (!access || !access.canView) {
    return NextResponse.json(
      { error: "Projet introuvable." },
      { status: 404 }
    );
  }
  if (!access.canManageMembers) {
    return NextResponse.json(
      { error: "Droits insuffisants." },
      { status: 403 }
    );
  }

  const membership = await db.projectMembership.findUnique({
    where: { projectId_userId: { projectId: id, userId } },
    include: { user: { select: { name: true } } },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "Cet utilisateur n'est pas assigne au projet." },
      { status: 404 }
    );
  }

  await db.projectMembership.delete({
    where: { projectId_userId: { projectId: id, userId } },
  });

  await logAudit({
    action: "MEMBER_REMOVED",
    userId: user.id,
    projectId: id,
    detail: `Retrait de ${membership.user.name} du projet ${access.project.name}`,
  });

  return NextResponse.json({ ok: true });
}
