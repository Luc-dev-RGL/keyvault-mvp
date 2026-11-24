import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// POST /api/me/secrets/:id/reveal - reveler la valeur d'un secret personnel
// (proprietaire uniquement, CA10). Action journalisee (CA5), reponse no-store.

export async function POST(
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

  const value = decrypt({
    valueEnc: secret.valueEnc,
    iv: secret.iv,
    authTag: secret.authTag,
  });

  await logAudit({
    action: "PERSONAL_SECRET_REVEALED",
    userId: user.id,
    detail: `Révélation du secret personnel ${secret.key}`,
  });

  return NextResponse.json(
    { secret: { id: secret.id, key: secret.key, value } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
