import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/access";
import { decrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// POST /api/projects/:id/secrets/:secretId/reveal - dechiffrement a la
// demande (spec 9). Acces reserve aux personnes assignees au projet
// (isMember) et au superviseur designe — un admin NON assigne recoit 403
// (moindre privilege, CA1 + CA3). L'action est journalisee (CA5) et la
// reponse est en no-store (spec 6.5).
//
// Le frontend masque a nouveau la valeur apres 30 secondes (CA6).

export async function POST(
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
  const access = await getProjectAccess(user, id);
  if (!access || !access.canView) {
    return NextResponse.json(
      { error: "Projet introuvable." },
      { status: 404 }
    );
  }
  if (!access.canReveal) {
    return NextResponse.json(
      {
        error:
          "Révélation réservée aux personnes assignées au projet (ou au superviseur désigné).",
      },
      { status: 403 }
    );
  }

  const secret = await db.secret.findUnique({ where: { id: secretId } });
  if (!secret || secret.projectId !== id) {
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
    action: "SECRET_REVEALED",
    userId: user.id,
    projectId: id,
    detail: `Révélation du secret ${secret.key} (projet ${access.project.name})`,
  });

  return NextResponse.json(
    { secret: { id: secret.id, key: secret.key, value } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
