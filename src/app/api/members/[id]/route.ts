import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, publicUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// PUT /api/members/:id - administration d'un compte (admin uniquement, spec 9)
// Actions : changement de role, activation / desactivation,
// reinitialisation du mot de passe (nouveau temporaire, CA8 + CA7).
const updateSchema = z.object({
  action: z.enum(["setRole", "setActive", "resetPassword"]),
  role: z.enum(["ADMIN", "SUPERVISOR", "MEMBER"]).optional(),
  isActive: z.boolean().optional(),
});

function generateTempPassword(): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(14);
  let out = "";
  for (const byte of bytes) {
    out += alphabet[byte % alphabet.length];
  }
  return out;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionUser();
  if (!admin) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }
  if (admin.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Droits insuffisants." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const member = await db.user.findUnique({ where: { id } });
  if (!member) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  // Auto-protection : l'admin ne peut pas modifier son propre compte
  // ici (role / activation / reinitialisation) afin d'eviter tout blocage.
  // Pour lui-meme, il passe par "Mon profil".
  if (member.id === admin.id) {
    return NextResponse.json(
      { error: "Utilisez Mon profil pour modifier votre propre compte." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  switch (parsed.data.action) {
    case "setRole": {
      if (!parsed.data.role) {
        return NextResponse.json(
          { error: "Role manquant." },
          { status: 400 }
        );
      }
      const updated = await db.user.update({
        where: { id: member.id },
        data: { role: parsed.data.role },
      });
      await logAudit({
        action: "USER_UPDATED",
        userId: admin.id,
        detail: `Changement de rôle de ${member.email} vers ${parsed.data.role}`,
      });
      return NextResponse.json({ member: publicUser(updated) });
    }

    case "setActive": {
      if (typeof parsed.data.isActive !== "boolean") {
        return NextResponse.json(
          { error: "Statut manquant." },
          { status: 400 }
        );
      }
      const updated = await db.user.update({
        where: { id: member.id },
        data: { isActive: parsed.data.isActive },
      });
      // Un compte desactive ne peut plus se connecter et ses sessions
      // existantes sont rejetees des la prochaine requete (CA8).
      await logAudit({
        action: parsed.data.isActive ? "USER_UPDATED" : "USER_DEACTIVATED",
        userId: admin.id,
        detail: parsed.data.isActive
          ? `Réactivation du compte ${member.email}`
          : `Désactivation du compte ${member.email}`,
      });
      return NextResponse.json({ member: publicUser(updated) });
    }

    case "resetPassword": {
      const temporaryPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      await db.user.update({
        where: { id: member.id },
        data: { passwordHash, mustChangePassword: true },
      });
      await logAudit({
        action: "PASSWORD_RESET",
        userId: admin.id,
        detail: `Réinitialisation du mot de passe de ${member.email}`,
      });
      // Le nouveau mot de passe temporaire n'est retourne qu'ici.
      return NextResponse.json({ temporaryPassword });
    }

    default:
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
