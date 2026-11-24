import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/access";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// POST /api/projects/:id/secrets - ajout d'un secret (superviseur du projet
// ou admin, spec 9). La valeur est chiffree AES-256-GCM avant ecriture ;
// seuls valueEnc / iv / authTag sont stockes (spec 6.2, CA4).

// Format des noms de variables d'environnement (spec 5.4)
const KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

const createSchema = z.object({
  key: z.string().regex(KEY_REGEX, "Format de cle invalide").max(100),
  value: z.string().min(1).max(10000),
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
  if (!access.canManageSecrets) {
    return NextResponse.json(
      { error: "Seul le superviseur du projet ou l'admin peut ajouter des secrets." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Clé invalide : lettres, chiffres et underscores, en commençant par une lettre ou un underscore.",
      },
      { status: 400 }
    );
  }

  const key = parsed.data.key;
  const existing = await db.secret.findUnique({
    where: { projectId_key: { projectId: id, key } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Cette clé existe déjà dans le projet." },
      { status: 409 }
    );
  }

  const encrypted = encrypt(parsed.data.value);
  const secret = await db.secret.create({
    data: {
      projectId: id,
      key,
      valueEnc: encrypted.valueEnc,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      updatedById: user.id,
    },
    select: { id: true, key: true, updatedAt: true },
  });

  // Detail synthetique : JAMAIS de valeur de secret dans le journal (CA9)
  await logAudit({
    action: "SECRET_CREATED",
    userId: user.id,
    projectId: id,
    detail: `Ajout du secret ${key} au projet ${access.project.name}`,
  });

  return NextResponse.json({ secret }, { status: 201 });
}
