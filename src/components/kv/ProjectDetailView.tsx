"use client";

// ---------------------------------------------------------------------------
// KeyVault - Detail d'un coffre projet : infos, secrets, membres, export .env
// - Les valeurs chiffrees ne sont jamais affichees : revelation ponctuelle
//   avec compte a rebours 30 s (CA6) ou copie jetable.
// - Sections filtrees selon myAccess (moindre privilege, CA1/CA3).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Download,
  FolderKanban,
  KeyRound,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiDownload, apiFetch, type DirectoryUser, type ProjectDetail, type ProjectMember, type ProjectSummary, type KvUser } from "./api";
import {
  AvatarInitials,
  BackLink,
  Chip,
  ConfirmDialog,
  EmptyState,
  ListSkeleton,
  PageHeader,
  StatCard,
} from "./shared";
import {
  AddSecretButton,
  SecretFormDialog,
  SecretList,
  type SecretListItem,
} from "./SecretComponents";

function AccessChips({ access }: { access: ProjectDetail["myAccess"] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {access.isAdmin ? <Chip tone="blue">Administrateur</Chip> : null}
      {access.isSupervisor ? <Chip tone="amber">Superviseur du projet</Chip> : null}
      {access.isMember ? <Chip tone="teal">Membre assigné</Chip> : null}
      {access.canReveal ? (
        <Chip tone="green">
          <ShieldCheck aria-hidden="true" />
          Révélation + export autorisés
        </Chip>
      ) : (
        <Chip tone="outline">Lecture des clés masquées uniquement</Chip>
      )}
    </div>
  );
}

export function ProjectDetailView({
  projectId,
  summary,
  currentUser,
  onBack,
  onDeleted,
}: {
  projectId: string;
  summary: ProjectSummary | null;
  currentUser: KvUser;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [supervisorName, setSupervisorName] = useState<string | null>(
    summary?.supervisor?.name ?? null
  );

  // Dialogs secrets
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SecretListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretListItem | null>(null);
  const [deletingSecret, setDeletingSecret] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  // Suppression du projet (admin)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // Membres
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [directory, setDirectory] = useState<DirectoryUser[] | null>(null);
  const [assignPending, setAssignPending] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProjectMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await apiFetch<ProjectDetail>(`/api/projects/${projectId}`);
      setDetail(data);
      setNotFound(false);
    } catch (err) {
      const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
      if (status === 404) {
        setNotFound(true);
      } else {
        setLoadError(err instanceof Error ? err.message : "Chargement impossible.");
      }
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Le nom du superviseur n'arrive pas dans le detail (seulement son id) :
  // on le complete via l'annuaire quand le role le permet, sinon on garde
  // le nom connu depuis la liste des projets.
  useEffect(() => {
    if (supervisorName || !detail?.project.supervisor) return;
    if (currentUser.role !== "ADMIN" && currentUser.role !== "SUPERVISOR") return;
    apiFetch<{ users: DirectoryUser[] }>("/api/members/directory")
      .then((data) => {
        const found = data.users.find((u) => u.id === detail.project.supervisor?.id);
        if (found) setSupervisorName(found.name);
      })
      .catch(() => {
        // Silencieux : le libelle restera generique
      });
  }, [detail, supervisorName, currentUser.role]);

  const loadDirectory = useCallback(async () => {
    try {
      const data = await apiFetch<{ users: DirectoryUser[] }>("/api/members/directory");
      setDirectory(data.users);
    } catch {
      setDirectory([]);
    }
  }, []);

  const openAssignDialog = () => {
    setAssignUserId("");
    loadDirectory();
    setAssignOpen(true);
  };

  const assignedIds = new Set((detail?.members ?? []).map((m) => m.userId));
  const assignableUsers = (directory ?? []).filter((u) => !assignedIds.has(u.id));

  const handleAssign = async () => {
    if (!assignUserId) return;
    setAssignPending(true);
    try {
      await apiFetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        body: { userId: assignUserId },
      });
      toast.success("Membre assigné au projet.");
      setAssignOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assignation impossible.");
    } finally {
      setAssignPending(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setRemovingMember(true);
    try {
      await apiFetch(`/api/projects/${projectId}/members/${removeTarget.userId}`, {
        method: "DELETE",
      });
      toast.success("Membre retiré du projet.");
      setRemoveTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retrait impossible.");
    } finally {
      setRemovingMember(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await apiDownload(`/api/projects/${projectId}/export`);
      const blob = await response.blob();

      // Nom de fichier depuis Content-Disposition, sinon le nom du projet
      let filename = `${detail?.project.name ?? "projet"}.env`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      if (match) filename = match[1];

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Export .env téléchargé. Cette action est journalisée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export impossible.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeletingProject(true);
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      toast.success("Projet supprimé.");
      setDeleteProjectOpen(false);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setDeletingProject(false);
    }
  };

  const handleDeleteSecret = async () => {
    if (!deleteTarget) return;
    setDeletingSecret(true);
    try {
      await apiFetch(`/api/projects/${projectId}/secrets/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("Secret supprimé.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setDeletingSecret(false);
    }
  };

  const secretsAsItems: SecretListItem[] = (detail?.secrets ?? []).map((secret) => ({
    id: secret.id,
    key: secret.key,
    updatedAt: secret.updatedAt,
    updatedByName: secret.updatedBy?.name,
  }));

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------

  if (notFound) {
    return (
      <div className="space-y-6">
        <BackLink label="Retour aux projets" onClick={onBack} />
        <EmptyState
          icon={FolderKanban}
          title="Coffre introuvable ou accès refusé."
          description="Le projet n'existe plus, ou votre compte n'y a pas été assigné."
          action={
            <Button type="button" size="sm" variant="outline" onClick={onBack}>
              Voir les projets
            </Button>
          }
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-6">
        <BackLink label="Retour aux projets" onClick={onBack} />
        {loadError ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="kv-card space-y-2 p-5">
              <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
            <ListSkeleton rows={4} />
          </div>
        )}
      </div>
    );
  }

  const access = detail.myAccess;

  return (
    <div className="space-y-6">
      <BackLink label="Retour aux projets" onClick={onBack} />

      {/* En-tete coffre */}
      <div className="space-y-5">
        <PageHeader
          kicker={`Coffre · ${supervisorName ? `Supervisé par ${supervisorName}` : "Superviseur non désigné"}`}
          title={
            <>
              <FolderKanban className="size-6 shrink-0 text-[var(--brand-strong)] dark:text-[var(--accent-foreground)]" aria-hidden="true" />
              <span className="break-all">{detail.project.name}</span>
            </>
          }
          description={detail.project.description || undefined}
          actions={
            <>
              {access.canReveal ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  <Download aria-hidden="true" />
                  {exporting ? "…" : "Exporter .env"}
                </Button>
              ) : null}
              {access.isAdmin ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteProjectOpen(true)}
                >
                  <Trash2 aria-hidden="true" />
                  Supprimer
                </Button>
              ) : null}
            </>
          }
        />

        <AccessChips access={access} />

        {/* Statistiques du coffre */}
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={KeyRound}
            label="Secrets"
            value={secretsAsItems.length}
            hint={access.canReveal ? "Révélation 30 s max (CA6)" : "Clés masquées"}
          />
          <StatCard
            icon={Users}
            label="Membres assignés"
            value={detail.members?.length ?? 0}
            hint="Accès aux valeurs du coffre"
          />
          <StatCard
            icon={ShieldCheck}
            label="Chiffrement"
            value="AES-256-GCM"
            hint="IV unique par valeur"
          />
        </div>
      </div>

      {/* Secrets */}
      <section className="kv-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <KeyRound className="size-4 text-[var(--brand-strong)] dark:text-[var(--accent-foreground)]" aria-hidden="true" />
              Secrets du coffre
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {access.canReveal
                ? "Les valeurs ne s'affichent que sur révélation, pendant 30 secondes maximum."
                : "Les valeurs chiffrées ne sont jamais affichées ici."}
            </p>
          </div>
          {access.canManageSecrets ? (
            <AddSecretButton onClick={() => setSecretDialogOpen(true)} />
          ) : null}
        </div>

        {secretsAsItems.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Aucun secret dans ce coffre."
            description={
              access.canManageSecrets
                ? "Ajoutez la première variable d'environnement."
                : "Le superviseur du projet peut ajouter des variables d'environnement."
            }
          />
        ) : (
          <SecretList
            secrets={secretsAsItems}
            canManage={access.canManageSecrets}
            canReveal={access.canReveal}
            revealUrlFor={(secretId) =>
              `/api/projects/${projectId}/secrets/${secretId}/reveal`
            }
            onEdit={(secretId) => {
              const target = secretsAsItems.find((s) => s.id === secretId) ?? null;
              setEditTarget(target);
            }}
            onDelete={(secretId) => {
              const target = secretsAsItems.find((s) => s.id === secretId) ?? null;
              setDeleteTarget(target);
            }}
          />
        )}
      </section>

      {/* Membres - gestion reservee au superviseur du projet / admin */}
      {access.canManageMembers ? (
        <section className="kv-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Users className="size-4 text-[var(--brand-strong)] dark:text-[var(--accent-foreground)]" aria-hidden="true" />
                Membres du projet
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Seules les personnes assignées peuvent révéler les valeurs du coffre.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={openAssignDialog}>
              <UserRoundPlus aria-hidden="true" />
              Assigner un membre
            </Button>
          </div>

          {(detail.members ?? []).length === 0 ? (
            <EmptyState
              icon={Users}
              title="Aucun membre assigné."
              description="Assignez des comptes pour leur donner accès aux valeurs."
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {(detail.members ?? []).map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AvatarInitials name={member.user.name} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="truncate">{member.user.name}</span>
                        {!member.user.isActive ? <Chip tone="red">Inactif</Chip> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRemoveTarget(member)}
                  >
                    <Trash2 aria-hidden="true" />
                    Retirer
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Dialogs secrets */}
      <SecretFormDialog
        open={secretDialogOpen}
        onOpenChange={setSecretDialogOpen}
        mode="create"
        submitLabel="Ajouter le secret"
        description="Format de clé : lettres, chiffres et underscores, en commençant par une lettre ou un underscore."
        onSubmit={async ({ key, value }) => {
          await apiFetch(`/api/projects/${projectId}/secrets`, {
            method: "POST",
            body: { key, value: value ?? "" },
          });
          toast.success("Secret ajouté.");
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
          await apiFetch(`/api/projects/${projectId}/secrets/${editTarget.id}`, {
            method: "PUT",
            body,
          });
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
        title="Supprimer ce secret ?"
        description={
          deleteTarget
            ? `La clé "${deleteTarget.key}" et sa valeur chiffrée seront définitivement supprimées du projet.`
            : ""
        }
        confirmLabel="Supprimer"
        destructive
        pending={deletingSecret}
        onConfirm={handleDeleteSecret}
      />

      <ConfirmDialog
        open={deleteProjectOpen}
        onOpenChange={setDeleteProjectOpen}
        title="Supprimer ce coffre ?"
        description="Tous les secrets et les assignations de membres du projet seront définitivement supprimés. Cette action est irréversible."
        confirmLabel="Supprimer le coffre"
        destructive
        pending={deletingProject}
        onConfirm={handleDeleteProject}
      />

      {/* Assignation de membre */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assigner un membre</DialogTitle>
            <DialogDescription>
              Choisissez un compte actif dans l&apos;annuaire. Les membres déjà
              assignés ne sont pas proposés.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="assign-member">Compte à assigner</Label>
            <Select
              value={assignUserId}
              onValueChange={setAssignUserId}
              disabled={assignPending || directory === null}
            >
              <SelectTrigger id="assign-member" className="w-full">
                <SelectValue
                  placeholder={
                    directory === null
                      ? "Chargement…"
                      : assignableUsers.length === 0
                        ? "Aucun compte disponible"
                        : "Choisir un compte"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {assignableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assignPending}>
              Annuler
            </Button>
            <Button onClick={handleAssign} disabled={assignPending || !assignUserId}>
              {assignPending ? "Assignation…" : "Assigner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Retirer ce membre du projet ?"
        description={
          removeTarget
            ? `${removeTarget.user.name} perdra immédiatement l'accès aux valeurs du coffre.`
            : ""
        }
        confirmLabel="Retirer"
        destructive
        pending={removingMember}
        onConfirm={handleRemoveMember}
      />
    </div>
  );
}
