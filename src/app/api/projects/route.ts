import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// GET  /api/projects - projets visibles selon le role (spec 5.2, 9)
//      admin -> tous ; superviseur -> ses projets + ceux ou il est assigne ;
//      membre -> ceux ou il est assigne.
// POST /api/projects - creation par l'admin avec designation du superviseur.

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  const projects = await db.project.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { members: { some: { userId: user.id } } },
              { supervisorId: user.id },
            ],
          },
    orderBy: { name: "asc" },
    include: {
      supervisor: { select: { id: true, name: true } },
      _count: { select: { secrets: true, members: true } },
    },
  });

  return NextResponse.json({ projects });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
  supervisorId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Seul l'administrateur peut créer un projet." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Nom, description et superviseur requis." },
      { status: 400 }
    );
  }

  const supervisor = await db.user.findUnique({
    where: { id: parsed.data.supervisorId },
  });
  if (!supervisor || !supervisor.isActive) {
    return NextResponse.json(
      { error: "Superviseur introuvable ou désactivé." },
      { status: 400 }
    );
  }

  const nameTaken = await db.project.findFirst({
    where: { name: parsed.data.name.trim() },
  });
  if (nameTaken) {
    return NextResponse.json(
      { error: "Un projet porte déjà ce nom." },
      { status: 409 }
    );
  }

  const project = await db.project.create({
    data: {
      name: parsed.data.name.trim(),
      description: parsed.data.description.trim(),
      supervisorId: supervisor.id,
      createdById: user.id,
    },
  });

  await logAudit({
    action: "PROJECT_CREATED",
    userId: user.id,
    projectId: project.id,
    detail: `Création du projet ${project.name} (superviseur : ${supervisor.name})`,
  });

  return NextResponse.json({ project }, { status: 201 });
}
