import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getProjectAccess } from "@/lib/access";
import { decrypt } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

// GET /api/projects/:id/export - telechargement du fichier .env (spec 5.4)
// - format : KEY=value, une ligne par secret, trie par cle (CA11)
// - acces : personnes assignees + superviseur designe (403 sinon, CA1/CA3)
// - action journalisee (CA5)
// - reponse no-store (spec 6.5)

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}

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
  if (!access.canReveal) {
    return NextResponse.json(
      {
        error:
          "Export réservé aux personnes assignées au projet (ou au superviseur désigné).",
      },
      { status: 403 }
    );
  }

  const secrets = await db.secret.findMany({
    where: { projectId: id },
    orderBy: { key: "asc" }, // trie par cle (CA11)
  });

  const lines = secrets.map((secret) => {
    const value = decrypt({
      valueEnc: secret.valueEnc,
      iv: secret.iv,
      authTag: secret.authTag,
    });
    return `${secret.key}=${value}`;
  });
  const fileContent = lines.length > 0 ? lines.join("\n") + "\n" : "";

  await logAudit({
    action: "ENV_EXPORTED",
    userId: user.id,
    projectId: id,
    detail: `Export .env du projet ${access.project.name} (${secrets.length} secrets)`,
  });

  return new NextResponse(fileContent, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(access.project.name)}.env"`,
      "Cache-Control": "no-store",
    },
  });
}
