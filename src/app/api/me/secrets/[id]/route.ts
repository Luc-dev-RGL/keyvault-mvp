import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// PUT    /api/me/secrets/:id - modifier un secret personnel (proprietaire
//        uniquement). Toute autre personne - y compris l'admin - recoit 404 :
//        le coffre personnel est strictement prive (CA10).
// DELETE /api/me/secrets/:id - supprimer un secret personnel (proprietaire).

const KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

const updateSchema = z.object({
  key: z
    .string()
    .regex(KEY_REGEX, "Format de cle invalide")
    .max(100)
    .optional(),
  value: z.string().min(1).max(10000).optional(),
});

export async function PUT(
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
  const secret = await db.personalSecret.findUnique({ where: { id } });
  // 404 si inexistant OU si non-proprietaire : on ne divulgue rien (CA10)
  if (!secret || secret.userId !== user.id) {
    return NextResponse.json(
      { error: "Secret introuvable." },
      { status: 404 }
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

  const newKey = parsed.data.key ?? secret.key;
  if (newKey !== secret.key) {
    const conflict = await db.personalSecret.findUnique({
      where: { userId_key: { userId: user.id, key: newKey } },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Cette clé existe déjà dans votre coffre." },
        { status: 409 }
      );
    }
  }

  const data: { key: string; valueEnc?: string; iv?: string; authTag?: string } = {
    key: newKey,
  };
  if (parsed.data.value) {
    const encrypted = encrypt(parsed.data.value);
    data.valueEnc = encrypted.valueEnc;
    data.iv = encrypted.iv;
    data.authTag = encrypted.authTag;
  }

  const updated = await db.personalSecret.update({
    where: { id },
    data,
    select: { id: true, key: true, updatedAt: true },
  });

  await logAudit({
    action: "PERSONAL_SECRET_UPDATED",
    userId: user.id,
    detail: `Modification du secret personnel ${newKey}`,
  });

  return NextResponse.json({ secret: updated });
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

  const { id } = await params;
  const secret = await db.personalSecret.findUnique({ where: { id } });
  if (!secret || secret.userId !== user.id) {
    return NextResponse.json(
      { error: "Secret introuvable." },
      { status: 404 }
    );
  }

  await db.personalSecret.delete({ where: { id } });

  await logAudit({
    action: "PERSONAL_SECRET_DELETED",
    userId: user.id,
    detail: `Suppression du secret personnel ${secret.key}`,
  });

  return NextResponse.json({ ok: true });
}
