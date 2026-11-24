"use client";

// ---------------------------------------------------------------------------
// KeyVault - Mon espace : profil, coffre personnel (prive, CA10) et
// historique d'activite. Trois onglets.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  Lock,
  ScrollText,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRound,
  Vault,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch, actionLabel, type ActivityEntry, type KvUser, type PersonalSecret } from "./api";
import {
  AuditActionBadge,
  Chip,
  ConfirmDialog,
  EmptyState,
  ListSkeleton,
  PageHeader,
  RoleBadge,
  SectionHeader,
  formatDate,
  formatDateTime,
} from "./shared";
import {
  AddSecretButton,
  SecretFormDialog,
  SecretList,
  type SecretListItem,
} from "./SecretComponents";

// ---------------------------------------------------------------------------
// Onglet Profil
// ---------------------------------------------------------------------------

function ProfileTab({
  user,
  onUserUpdated,
}: {
  user: KvUser;
  onUserUpdated: () => void;
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
      toast.success("Mot de passe modifié.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onUserUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4" aria-hidden="true" />
            Informations du compte
          </CardTitle>
          <CardDescription>Vos données d&apos;identification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Nom</span>
            <span className="text-sm font-medium">{user.name}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">E-mail</span>
            <span className="min-w-0 truncate text-sm font-medium">{user.email}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Rôle</span>
            <RoleBadge role={user.role} />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Compte cree le</span>
            <span className="text-sm font-medium">{formatDate(user.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4" aria-hidden="true" />
            Changer mon mot de passe
          </CardTitle>
          <CardDescription>8 caractères minimum pour le nouveau mot de passe.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="profile-current">Mot de passe actuel</Label>
              <Input
                id="profile-current"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={pending}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-new">Nouveau mot de passe</Label>
              <Input
                id="profile-new"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={pending}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-confirm">Confirmer le nouveau mot de passe</Label>
              <Input
                id="profile-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={pending}
                autoComplete="new-password"
                required
              />
            </div>

            {error ? (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement..." : "Modifier le mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onglet Coffre (prive)
// ---------------------------------------------------------------------------

function VaultTab() {
  const [secrets, setSecrets] = useState<PersonalSecret[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SecretListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<{ secrets: PersonalSecret[] }>("/api/me/secrets");
      setSecrets(data.secrets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
      setSecrets([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items: SecretListItem[] = (secrets ?? []).map((secret) => ({
    id: secret.id,
    key: secret.key,
    updatedAt: secret.updatedAt,
  }));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/me/secrets/${deleteTarget.id}`, { method: "DELETE" });
      toast.success("Secret supprimé de votre coffre.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setDeleting(false);
    }
  };

  if (error && secrets === null) {
    return (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (secrets === null) {
    return <ListSkeleton rows={4} />;
  }

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          icon={Vault}
          title="Mon coffre personnel"
          description="Strictement privé : personne d'autre ne peut voir ou modifier ces secrets, même l'administrateur (CA10)."
          actions={<AddSecretButton onClick={() => setCreateOpen(true)} />}
        />
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={Vault}
            title="Votre coffre est vide."
            description="Ajoutez vos variables d'environnement personnelles : elles sont chiffrées et restent privées."
            action={<AddSecretButton onClick={() => setCreateOpen(true)} />}
          />
        ) : (
          <SecretList
            secrets={items}
            canManage
            canReveal
            revealUrlFor={(secretId) => `/api/me/secrets/${secretId}/reveal`}
            onEdit={(secretId) => {
              setEditTarget(items.find((s) => s.id === secretId) ?? null);
            }}
            onDelete={(secretId) => {
              setDeleteTarget(items.find((s) => s.id === secretId) ?? null);
            }}
          />
        )}
      </CardContent>

      <SecretFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        submitLabel="Ajouter au coffre"
        description="Format de clé : lettres, chiffres et underscores, en commençant par une lettre ou un underscore."
        onSubmit={async ({ key, value }) => {
          await apiFetch("/api/me/secrets", {
            method: "POST",
            body: { key, value: value ?? "" },
          });
          toast.success("Secret ajouté à votre coffre.");
          await load();
        }}
      />

      <SecretFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        mode="edit"
        initialKey={editTarget?.key}
        submitLabel="Modifier le secret"
        description="Renommez la clé et/ou fournissez une nouvelle valeur. La valeur actuelle est conservée si le champ reste vide."
        onSubmit={async ({ key, value }) => {
          if (!editTarget) return;
          const body: { key: string; value?: string } = { key };
          if (value !== null) body.value = value;
          await apiFetch(`/api/me/secrets/${editTarget.id}`, { method: "PUT", body });
          toast.success("Secret modifié.");
          setEditTarget(null);
          await load();
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Supprimer ce secret personnel ?"
        description={
          deleteTarget
            ? `La clé "${deleteTarget.key}" et sa valeur chiffrée seront définitivement supprimées de votre coffre.`
            : ""
        }
        confirmLabel="Supprimer"
        destructive
        pending={deleting}
        onConfirm={handleDelete}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Onglet Activite
// ---------------------------------------------------------------------------

function ActivityTab() {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ entries: ActivityEntry[] }>("/api/me/activity")
      .then((data) => setEntries(data.entries))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Chargement impossible.");
        setEntries([]);
      });
  }, []);

  if (entries === null && !error) {
    return <ListSkeleton rows={5} />;
  }

  if (error) {
    return (
      <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            icon={ScrollText}
            title="Aucune activité pour le moment."
            description="Vos 50 dernières actions apparaîtront ici."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          icon={ScrollText}
          title="Mon activité"
          description="Les 50 dernières actions enregistrées sur votre compte."
        />
      </CardHeader>
      <CardContent>
        <ul className="kv-scroll max-h-96 space-y-2 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <li key={entry.id} className="kv-card kv-card--hover flex items-start justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <AuditActionBadge action={entry.action} label={actionLabel(entry.action)} />
                  {entry.project ? <Chip tone="outline">{entry.project.name}</Chip> : null}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{entry.detail}</p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {formatDateTime(entry.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Vue complete
// ---------------------------------------------------------------------------

export function MonEspaceView({
  user,
  onUserUpdated,
}: {
  user: KvUser;
  onUserUpdated: () => void;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Console · Espace personnel"
        title="Mon espace"
        description="Votre profil, votre coffre personnel privé et votre historique d'activité."
      />

      <Tabs defaultValue="profil">
        <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="profil" className="gap-1.5">
            <UserRound aria-hidden="true" />
            Mon profil
          </TabsTrigger>
          <TabsTrigger value="coffre" className="gap-1.5">
            <KeyRound aria-hidden="true" />
            Mon coffre
          </TabsTrigger>
          <TabsTrigger value="activite" className="gap-1.5">
            <ScrollText aria-hidden="true" />
            Mon activité
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="mt-6">
          <ProfileTab user={user} onUserUpdated={onUserUpdated} />
        </TabsContent>
        <TabsContent value="coffre" className="mt-6">
          <VaultTab />
        </TabsContent>
        <TabsContent value="activite" className="mt-6">
          <ActivityTab />
        </TabsContent>
      </Tabs>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Trash2 className="size-3.5" aria-hidden="true" />
        Supprimer un secret du coffre efface sa valeur chiffrée définitivement.
        <Chip tone="mono" className="ml-auto">CA10 · PRIVÉ</Chip>
      </p>
    </div>
  );
}
