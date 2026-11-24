"use client";

// ---------------------------------------------------------------------------
// KeyVault - Ecran de connexion (style console)
// Message d'erreur generique : le serveur ne divulgue jamais l'existence
// d'un compte (spec 6.7). Panneau de marque + carte de connexion.
// ---------------------------------------------------------------------------

import { useState } from "react";
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  Vault,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, type KvUser } from "./api";

const SECURITY_POINTS = [
  {
    icon: ShieldCheck,
    title: "Chiffrement au repos",
    text: "AES-256-GCM, IV unique par valeur : la base de données, volée, ne révèle rien.",
  },
  {
    icon: KeyRound,
    title: "Accès par projet",
    text: "Seules les personnes assignées peuvent révéler les secrets d'un coffre.",
  },
  {
    icon: ScrollText,
    title: "Traçabilité complète",
    text: "Révélations, copies et exports journalisés, sans jamais stocker les valeurs.",
  },
];

export function LoginView({
  onLoggedIn,
}: {
  onLoggedIn: (user: KvUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await apiFetch<{ user: KvUser }>("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      onLoggedIn(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen">
      {/* Panneau de marque - desktop */}
      <section
        className="kv-grid-bg relative hidden w-[46%] flex-col justify-between border-r bg-[var(--brand-tint)]/40 p-10 lg:flex"
        aria-hidden="true"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Vault className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight">KeyVault</p>
            <p className="kv-kicker">Console interne · édition blanc pur</p>
          </div>
        </div>

        <div className="max-w-lg space-y-7">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="kv-chip kv-chip--mono">AES-256-GCM</span>
              <span className="kv-chip kv-chip--mono">JWT httpOnly</span>
              <span className="kv-chip kv-chip--mono">RBAC</span>
              <span className="kv-chip kv-chip--mono">AUDIT IMMUTABLE</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              Vos variables d&apos;environnement,
              <span className="text-[var(--brand-strong)] dark:text-[var(--accent-foreground)]">
                {" "}chiffrées et sous contrôle.
              </span>
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Fini les clés d&apos;API qui circulent par e-mail ou par
              messagerie : un point d&apos;accès unique, des droits par projet
              et une traçabilité intégrale.
            </p>
          </div>

          <ul className="space-y-4">
            {SECURITY_POINTS.map((point) => (
              <li key={point.title} className="kv-card kv-card--hover flex items-start gap-3 p-4">
                <span className="kv-tile kv-tile--blue">
                  <point.icon className="size-[18px]" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{point.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{point.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="kv-dot-live" aria-hidden="true" />
          Système opérationnel — toutes les actions sont journalisées.
        </div>
      </section>

      {/* Carte de connexion */}
      <section className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-7">
          {/* Bloc marque - mobile uniquement */}
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <span className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Vault className="size-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">KeyVault</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Coffre-fort interne pour le partage sécurisé de secrets.
              </p>
            </div>
          </div>

          <div className="kv-card p-7">
            <div className="space-y-1.5">
              <p className="kv-kicker">Authentification requise</p>
              <h2 className="text-lg font-semibold">Connexion à la console</h2>
              <p className="text-sm text-muted-foreground">
                Utilisez les identifiants fournis par votre administrateur.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="login-email">Adresse e-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="prenom.nom@organisation.fr"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={pending}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Mot de passe</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={pending}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <TriangleAlert aria-hidden="true" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Connexion…" : "Accéder à la console"}
                <ArrowRight aria-hidden="true" />
              </Button>
            </form>
          </div>

          <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Fingerprint className="size-3.5" aria-hidden="true" />
            Accès réservé au personnel autorisé. Toute action est journalisée.
          </p>
        </div>
      </section>
    </main>
  );
}
