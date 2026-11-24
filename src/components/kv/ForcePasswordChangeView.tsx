"use client";

// ---------------------------------------------------------------------------
// KeyVault - Changement de mot de passe force (CA7)
// Bloquant : tant que le mot de passe temporaire n'a pas ete remplace,
// aucune autre vue n'est accessible.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Lock, LogOut, ShieldCheck, TriangleAlert, Vault } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, type KvUser } from "./api";

export function ForcePasswordChangeView({
  user,
  onPasswordChanged,
  onLogout,
}: {
  user: KvUser;
  onPasswordChanged: () => void;
  onLogout: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }

    setPending(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      toast.success("Mot de passe modifié. Bienvenue dans KeyVault.");
      onPasswordChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="kv-grid-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Vault className="size-7" aria-hidden="true" />
          </span>
          <div>
            <p className="kv-kicker">Première connexion</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              Sécurisez votre accès
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bienvenue {user.name}. Votre compte utilise un mot de passe
              temporaire : choisissez le vôtre pour continuer.
            </p>
          </div>
        </div>

        <div className="kv-card p-6">
          <div className="kv-reveal mb-5 flex items-start gap-2.5 rounded-lg p-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-[var(--amber-text)] dark:text-[#f5c451]" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-[var(--amber-text)] dark:text-[#f5c451]">
              Ce changement est obligatoire et unique. Ensuite, vous pourrez
              modifier votre mot de passe depuis Mon espace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="force-current">Mot de passe temporaire</Label>
              <Input
                id="force-current"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={pending}
                autoComplete="current-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="force-new">Nouveau mot de passe</Label>
              <Input
                id="force-new"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={pending}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="force-confirm">Confirmer le nouveau mot de passe</Label>
              <Input
                id="force-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={pending}
                autoComplete="new-password"
                required
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" className="flex-1" disabled={pending}>
                <ShieldCheck aria-hidden="true" />
                {pending ? "Enregistrement…" : "Définir mon mot de passe"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onLogout}
                disabled={pending}
              >
                <LogOut aria-hidden="true" />
                Se déconnecter
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
