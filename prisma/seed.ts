// KeyVault MVP - Seed initial (spec P0, section 10)
// Cree le compte administrateur a partir des variables ADMIN_* du .env.
// Idempotent : relancer le script ne modifie jamais un compte existant.
//
// Usage : bun run db:seed   (apres `bun run db:push`)

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = (process.env.ADMIN_NAME ?? "").trim();
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    console.error(
      "ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans .env (voir .env.example)"
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("ADMIN_PASSWORD doit contenir au moins 8 caractères.");
    process.exit(1);
  }

  // bcrypt cout 10 (spec section 6.1)
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {}, // ne touche jamais a un compte deja existant
    create: {
      name: name || "Administrateur",
      email,
      passwordHash,
      role: "ADMIN",
      isActive: true,
      // Le mot de passe du seed est choisi par l'admin lui-meme :
      // pas de changement force a la premiere connexion.
      mustChangePassword: false,
    },
  });

  console.log(`Compte administrateur prêt : ${admin.email}`);
  console.log("Connectez-vous puis changez votre mot de passe depuis Mon profil.");
}

main()
  .catch((error) => {
    console.error("Seed echoue :", error.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
