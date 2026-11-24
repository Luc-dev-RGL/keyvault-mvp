import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Secret, User } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getProjectAccess, type ProjectAccess } from "@/lib/access";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// PUT    /api/projects/:id/secrets/:secretId - modification (superviseur du
//        projet ou admin). Une nouvelle valeur est chiffree avec un NOUVEL
//        IV : deux ecritures de la meme valeur produisent deux textes
//        chiffres differents (CA4). Pas d'historique de versions en MVP.
// DELETE /api/projects/:id/secrets/:secretId - suppression.

const KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

const updateSchema = z.object({
  key: z
    .string()
    .regex(KEY_REGEX, "Format de cle invalide")
    .max(100)
    .optional(),
  value: z.string().min(1).max(10000).optional(),
});

type SecretLoad =
  | { status: "ok"; access: ProjectAccess; secret: Secret }
  | { status: "notFound" }
  | { status: "forbidden" };

async function loadSecretAndAccess(
  user: User,
  projectId: string,
  secretId: string
): Promise<SecretLoad> {
  const access = await getProjectAccess(user, projectId);
  if (!access || !access.canView) return { status: "notFound" };
  if (!access.canManageSecrets) return { status: "forbidden" };

  const secret = await db.secret.findUnique({ where: { id: secretId } });
  if (!secret || secret.projectId !== projectId) return { status: "notFound" };

  return { status: "ok", access, secret };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; secretId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  const { id, secretId } = await params;
  const loaded = await loadSecretAndAccess(user, id, secretId);
  if (loaded.status === "notFound") {
    return NextResponse.json(
      { error: "Secret introuvable." },
      { status: 404 }
    );
  }
  if (loaded.status === "forbidden") {
    return NextResponse.json(
      { error: "Seul le superviseur du projet ou l'admin peut modifier les secrets." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success || (!parsed.data.key && !parsed.data.value)) {
    return NextResponse.json(
      { error: "Fournir une nouvelle clé et/ou une nouvelle valeur." },
      { status: 400 }
    );
  }

  const newKey = parsed.data.key ?? loaded.secret.key;
  if (newKey !== loaded.secret.key) {
    const conflict = await db.secret.findUnique({
      where: { projectId_key: { projectId: id, key: newKey } },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Cette clé existe déjà dans le projet." },
        { status: 409 }
      );
    }
  }

  const data: { key: string; updatedById: string; valueEnc?: string; iv?: string; authTag?: string } = {
    key: newKey,
    updatedById: user.id,
  };
  if (parsed.data.value) {
    const encrypted = encrypt(parsed.data.value);
    data.valueEnc = encrypted.valueEnc;
    data.iv = encrypted.iv;
    data.authTag = encrypted.authTag;
  }

  const updated = await db.secret.update({
    where: { id: secretId },
    data,
    select: { id: true, key: true, updatedAt: true },
  });

  await logAudit({
    action: "SECRET_UPDATED",
    userId: user.id,
    projectId: id,
    detail: `Modification du secret ${newKey} dans le projet ${loaded.access.project.name}`,
  });

  return NextResponse.json({ secret: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; secretId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  const { id, secretId } = await params;
  const loaded = await loadSecretAndAccess(user, id, secretId);
  if (loaded.status === "notFound") {
    return NextResponse.json(
      { error: "Secret introuvable." },
      { status: 404 }
    );
  }
  if (loaded.status === "forbidden") {
    return NextResponse.json(
      { error: "Seul le superviseur du projet ou l'admin peut supprimer les secrets." },
      { status: 403 }
    );
  }

  await db.secret.delete({ where: { id: secretId } });

  await logAudit({
    action: "SECRET_DELETED",
    userId: user.id,
    projectId: id,
    detail: `Suppression du secret ${loaded.secret.key} du projet ${loaded.access.project.name}`,
  });

  return NextResponse.json({ ok: true });
}
