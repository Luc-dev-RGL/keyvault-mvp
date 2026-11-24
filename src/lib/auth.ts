import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";

// Session par JWT signe HS256 stocke dans un cookie httpOnly (spec 5.1)
// - httpOnly : jamais lisible par le JavaScript du navigateur (spec 6.4)
// - SameSite=Lax, Secure en production, expiration 7 jours
// - le cookie ne contient que l'identifiant utilisateur : a chaque requete,
//   l'utilisateur est recharge en base pour verifier isActive et le role
//   courant -> desactiver un compte invalide immediatement ses sessions (CA8)

const SESSION_COOKIE = "keyvault_session";
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 jours

function getSessionSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "SESSION_SECRET invalide ou manquante : attendu 64 caractères hexadécimaux (générer avec : openssl rand -hex 32)"
    );
  }
  return new Uint8Array(Buffer.from(raw, "hex"));
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// Retourne l'utilisateur courant, ou null si :
// - aucun cookie de session / token invalide ou expire
// - compte inexistant ou desactive (sessions invalides, CA8)
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const userId = payload.sub;
    if (!userId) return null;

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

// Reponse publique : jamais de passwordHash (spec 6.1)
export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}
