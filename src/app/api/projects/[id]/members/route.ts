import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/access";
import { logAudit } from "@/lib/audit";

// GET  /api/projects/:id/members - membres du projet (superviseur du projet
//      ou admin, spec 9)
// POST /api/projects/:id/members - assigner un membre (superviseur du projet
//      ou admin). Le retrait d'un membre revoque immediatement son acces.

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

  const members = await db.projectMembership.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, isActive: true } },
    },
  });

  return NextResponse.json({ members });
}

const assignSchema = z.object({
  userId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
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

  const body = await request.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Utilisateur requis." },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({
    where: { id: parsed.data.userId },
  });
  if (!target || !target.isActive) {
    return NextResponse.json(
      { error: "Utilisateur introuvable ou désactivé." },
      { status: 400 }
    );
  }

  const existing = await db.projectMembership.findUnique({
    where: { projectId_userId: { projectId: id, userId: target.id } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Cet utilisateur est déjà assigné au projet." },
      { status: 409 }
    );
  }

  await db.projectMembership.create({
    data: { projectId: id, userId: target.id, addedById: user.id },
  });

  await logAudit({
    action: "MEMBER_ASSIGNED",
    userId: user.id,
    projectId: id,
    detail: `Assignation de ${target.name} au projet ${access.project.name}`,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
