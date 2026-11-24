# Guide de livraison — KeyVault MVP

Ce paquet contient le projet complet **avec l'historique Git** (commits propres).

## 1. Pousser vers GitHub

```bash
# decompressez l'archive, puis :
cd keyvault-mvp

# branchez votre depot distant (le votre : keyvault-mvp)
git remote add origin https://github.com/Luc-dev-RGL/keyvault-mvp.git

# publiez (l'historique local devient la branche main)
git push -u origin main --force
```

## 2. Lancer le projet en local

```bash
bun install                       # ou : npm install
cp .env.example .env              # puis renseignez vos cles (openssl rand -hex 32)
docker compose up -d              # PostgreSQL 16 + Adminer
bun run db:push                   # cree les tables
bun run db:seed                   # cree le compte admin (variables ADMIN_* du .env)
bun run dev                       # http://localhost:3000
```

## 3. Identifiants de demonstration

Le compte admin est defini par `ADMIN_EMAIL` / `ADMIN_PASSWORD` dans votre `.env`
(local, jamais committe). Le mot de passe temporaire de chaque compte cree
depuis la console n'est affiche qu'une seule fois.
