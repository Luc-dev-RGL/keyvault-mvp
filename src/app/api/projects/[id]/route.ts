import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";

// GET    /api/projects/:id - detail + liste des cles MASQUEES (spec 9)
//        Reponse 404 si le projet n'existe pas OU si l'utilisateur n'y a pas
//        acces : on ne revele jamais l'existence d'un projet (spec 9, note).
// DELETE /api/projects/:id - suppression par l'admin uniquement (cascade).

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const access = await getProjectAccess(user, id);
  // Projet inexistant OU acces refuse -> meme reponse (404)
  if (!access || !access.canView) {
    return NextResponse.json(
      { error: "Projet introuvable." },
      { status: 404 }
    );
  }

  // Liste des cles uniquement : JAMAIS de valeur chiffree ici (CA9)
  const secrets = await db.secret.findMany({
    where: { projectId: id },
    orderBy: { key: "asc" },
    select: {
      id: true,
      key: true,
      updatedAt: true,
      updatedBy: { select: { name: true } },
    },
  });

  const members = access.canManageMembers
    ? await db.projectMembership.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "asc" },
        select: {
          userId: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, isActive: true } },
        },
      })
    : undefined;

  return NextResponse.json({
    project: {
      id: access.project.id,
      name: access.project.name,
      description: access.project.description,
      supervisor: access.project.supervisorId
        ? { id: access.project.supervisorId }
        : null,
      createdAt: access.project.createdAt,
    },
    secrets,
    members,
    myAccess: {
      isAdmin: access.isAdmin,
      isSupervisor: access.isSupervisor,
      isMember: access.isMember,
      canManageSecrets: access.canManageSecrets,
      canManageMembers: access.canManageMembers,
      canReveal: access.canReveal,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Seul l'administrateur peut supprimer un projet." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json(
      { error: "Projet introuvable." },
      { status: 404 }
    );
  }

  // Cascade Prisma : secrets et assignations supprimes avec le projet
  await db.project.delete({ where: { id } });

  await logAudit({
    action: "PROJECT_DELETED",
    userId: user.id,
    detail: `Suppression du projet ${project.name}`,
  });

  return NextResponse.json({ ok: true });
}
