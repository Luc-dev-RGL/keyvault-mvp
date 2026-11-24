import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// GET  /api/me/secrets - coffre personnel de l'utilisateur connecte (spec 5.5)
//      Liste MASQUEE : cles et metadonnees uniquement (CA9).
// POST /api/me/secrets - ajout d'un secret personnel.
//      Le coffre est STRICTEMENT prive : invisible pour tout autre
//      utilisateur, y compris l'admin (CA10).

const KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

const createSchema = z.object({
  key: z.string().regex(KEY_REGEX, "Format de cle invalide").max(100),
  value: z.string().min(1).max(10000),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  const secrets = await db.personalSecret.findMany({
    where: { userId: user.id },
    orderBy: { key: "asc" },
    select: { id: true, key: true, updatedAt: true },
  });

  return NextResponse.json({ secrets });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
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

  const existing = await db.personalSecret.findUnique({
    where: { userId_key: { userId: user.id, key: parsed.data.key } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Cette clé existe déjà dans votre coffre." },
      { status: 409 }
    );
  }

  const encrypted = encrypt(parsed.data.value);
  const secret = await db.personalSecret.create({
    data: {
      userId: user.id,
      key: parsed.data.key,
      valueEnc: encrypted.valueEnc,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    },
    select: { id: true, key: true, updatedAt: true },
  });

  await logAudit({
    action: "PERSONAL_SECRET_CREATED",
    userId: user.id,
    detail: `Ajout du secret personnel ${parsed.data.key}`,
  });

  return NextResponse.json({ secret }, { status: 201 });
}
