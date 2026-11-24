import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// POST /api/auth/change-password - changement de mot de passe (spec 9)
// - verifie le mot de passe actuel
// - reinitialise le flag mustChangePassword (fin du changement force, CA7)
// - bcrypt cout 10 (spec 6.1)
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(255),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." },
      { status: 400 }
    );
  }

  const currentOk = await bcrypt.compare(
    parsed.data.currentPassword,
    user.passwordHash
  );
  if (!currentOk) {
    return NextResponse.json(
      { error: "Mot de passe actuel incorrect." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  await logAudit({
    action: "PASSWORD_CHANGED",
    userId: user.id,
    detail: "Mot de passe modifié",
  });

  return NextResponse.json({ ok: true });
}
