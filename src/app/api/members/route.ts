import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, publicUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// GET  /api/members - liste des comptes (admin uniquement, spec 9)
// POST /api/members - creation de compte avec mot de passe temporaire
//                     affiche une seule fois a l'admin (spec 5.1, P1)

const memberPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

export async function GET() {
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

  const members = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { ...memberPublicSelect, _count: { select: { memberships: true } } },
  });

  return NextResponse.json({ members });
}

// Le role est choisi entre superviseur et membre a la creation (spec 5.1).
const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().min(3).max(255),
  role: z.enum(["SUPERVISOR", "MEMBER"]),
});

// Mot de passe temporaire : 14 caracteres d'un alphabet sans caracteres
// ambigus (pas de O/0, l/1, etc.), genere par le generateur cryptographique.
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

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Nom, e-mail et rôle valides requis." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet e-mail." },
      { status: 409 }
    );
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const member = await db.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      passwordHash,
      role: parsed.data.role,
      isActive: true,
      mustChangePassword: true, // changement force a la premiere connexion (CA7)
    },
  });

  await logAudit({
    action: "USER_CREATED",
    userId: admin.id,
    detail: `Création du compte ${email} (rôle ${parsed.data.role})`,
  });

  // Le mot de passe temporaire n'est retourne qu'ici, une seule fois.
  return NextResponse.json(
    { member: publicUser(member), temporaryPassword },
    { status: 201 }
  );
}
