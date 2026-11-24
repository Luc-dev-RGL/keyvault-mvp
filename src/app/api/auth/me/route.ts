import { NextResponse } from "next/server";
import { getSessionUser, publicUser } from "@/lib/auth";

// GET /api/auth/me - profil courant (spec 9)
// Inclut mustChangePassword : le frontend s'en sert pour afficher
// l'ecran de changement de mot de passe force (P2, CA7).
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentification requise." },
      { status: 401 }
    );
  }
  return NextResponse.json({ user: publicUser(user) });
}
