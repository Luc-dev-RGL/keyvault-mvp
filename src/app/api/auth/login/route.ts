import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, publicUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// POST /api/auth/login - connexion (spec 9)
// - message d'echec generique : pas d'enumeration de comptes (spec 6.7)
// - comparaison bcrypt effectuee meme si l'e-mail est inconnu afin
//   d'egaliser le temps de reponse
const loginSchema = z.object({
  email: z.string().min(3).max(255),
  password: z.string().min(1).max(255),
});

// Hash factice calcule une seule fois au chargement du module
const DUMMY_HASH = bcrypt.hashSync("mot-de-passe-factice", 10);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "E-mail ou mot de passe incorrect." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    user ? user.passwordHash : DUMMY_HASH
  );
  const isValid = Boolean(user) && user!.isActive && passwordMatches;

  if (!isValid) {
    await logAudit({
      action: "AUTH_LOGIN_FAILED",
      userId: user?.id ?? null,
      detail: "Échec de connexion",
    });
    return NextResponse.json(
      { error: "E-mail ou mot de passe incorrect." },
      { status: 401 }
    );
  }

  await createSession(user!.id);
  await logAudit({
    action: "AUTH_LOGIN",
    userId: user!.id,
    detail: "Connexion réussie",
  });

  return NextResponse.json({ user: publicUser(user!) });
}
