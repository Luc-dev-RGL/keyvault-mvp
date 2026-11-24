"use client";

// ---------------------------------------------------------------------------
// KeyVault - Vue Membres (admin) : comptes, roles, activation, reset
// Le mot de passe temporaire n'est affiche qu'une seule fois (CA7/CA8).
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import {
  KeyRound,
  MoreHorizontal,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, ROLE_LABELS, type AdminMember, type Role } from "./api";
import {
  ActiveBadge,
  AvatarInitials,
  Chip,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  RoleBadge,
  TableSkeleton,
  TempPasswordAlert,
  formatDate,
} from "./shared";

type TempPasswordInfo = {
  title: string;
  description: string;
  password: string;
};

function PasswordTempBadge() {
  return (
    <Chip tone="amber">
      <KeyRound aria-hidden="true" />
      Mot de passe temporaire
    </Chip>
  );
}

function MemberActionsMenu({
  member,
  isSelf,
  disabled,
  onSetRole,
  onToggleActive,
  onResetPassword,
}: {
  member: AdminMember;
  isSelf: boolean;
  disabled: boolean;
  onSetRole: (member: AdminMember) => void;
  onToggleActive: (member: AdminMember) => void;
  onResetPassword: (member: AdminMember) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Actions pour ${member.name}`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{member.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isSelf ? (
          <DropdownMenuItem disabled>
            Votre propre compte : passez par Mon espace
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => onSetRole(member)}>
              <ShieldCheck aria-hidden="true" />
              Changer le rôle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleActive(member)}>
              <UserRound aria-hidden="true" />
              {member.isActive ? "Désactiver" : "Réactiver"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onResetPassword(member)}>
              <KeyRound aria-hidden="true" />
              Réinitialiser le mot de passe
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateMemberDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (temporaryPassword: string, member: AdminMember) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"SUPERVISOR" | "MEMBER">("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setRole("MEMBER");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    if (name.trim().length === 0) {
      setError("Le nom est obligatoire.");
      return;
    }
    if (email.trim().length < 3 || !email.includes("@")) {
      setError("Saisissez une adresse e-mail valide.");
      return;
    }

    setPending(true);
    try {
      const data = await apiFetch<{ member: AdminMember; temporaryPassword: string }>(
        "/api/members",
        {
          method: "POST",
          body: { name: name.trim(), email: email.trim(), role },
        }
      );
      toast.success(`Compte créé pour ${data.member.name}.`);
      onCreated(data.temporaryPassword, data.member);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau compte</DialogTitle>
          <DialogDescription>
            Un mot de passe temporaire sera généré : communiquez-le de façon
            sécurisée, il ne sera affiché qu&apos;une seule fois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-name">Nom complet</Label>
            <Input
              id="member-name"
              placeholder="Camille Durand"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-email">Adresse e-mail</Label>
            <Input
              id="member-email"
              type="email"
              placeholder="camille.durand@organisation.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
              maxLength={255}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-role">Rôle</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as "SUPERVISOR" | "MEMBER")}
              disabled={pending}
            >
              <SelectTrigger id="member-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPERVISOR">{ROLE_LABELS.SUPERVISOR}</SelectItem>
                <SelectItem value="MEMBER">{ROLE_LABELS.MEMBER}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Création…" : "Créer le compte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MembersView({ currentUserId }: { currentUserId: string }) {
  const [members, setMembers] = useState<AdminMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<TempPasswordInfo | null>(null);

  // Changement de role
  const [roleTarget, setRoleTarget] = useState<AdminMember | null>(null);
  const [roleValue, setRoleValue] = useState<Role>("MEMBER");
  const [rolePending, setRolePending] = useState(false);

  // Activation / desactivation
  const [deactivateTarget, setDeactivateTarget] = useState<AdminMember | null>(null);
  const [activateTarget, setActivateTarget] = useState<AdminMember | null>(null);

  // Reinitialisation
  const [resetTarget, setResetTarget] = useState<AdminMember | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await apiFetch<{ members: AdminMember[] }>("/api/members");
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
      setMembers([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSetRole = async () => {
    if (!roleTarget) return;
    setRolePending(true);
    try {
      await apiFetch(`/api/members/${roleTarget.id}`, {
        method: "PUT",
        body: { action: "setRole", role: roleValue },
      });
      toast.success(`Rôle mis à jour pour ${roleTarget.name}.`);
      setRoleTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setRolePending(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setMutatingId(deactivateTarget.id);
    try {
      await apiFetch(`/api/members/${deactivateTarget.id}`, {
        method: "PUT",
        body: { action: "setActive", isActive: false },
      });
      toast.success(`Compte de ${deactivateTarget.name} désactivé.`);
      setDeactivateTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setMutatingId(null);
    }
  };

  const handleActivate = async () => {
    if (!activateTarget) return;
    setMutatingId(activateTarget.id);
    try {
      await apiFetch(`/api/members/${activateTarget.id}`, {
        method: "PUT",
        body: { action: "setActive", isActive: true },
      });
      toast.success(`Compte de ${activateTarget.name} réactivé.`);
      setActivateTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setMutatingId(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setMutatingId(resetTarget.id);
    try {
      const data = await apiFetch<{ temporaryPassword: string }>(
        `/api/members/${resetTarget.id}`,
        {
          method: "PUT",
          body: { action: "resetPassword" },
        }
      );
      setResetTarget(null);
      setTempPassword({
        title: `Nouveau mot de passe temporaire pour ${resetTarget.name}`,
        description:
          "Le compte repassera par le changement de mot de passe forcé à sa prochaine connexion.",
        password: data.temporaryPassword,
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Réinitialisation impossible.");
    } finally {
      setMutatingId(null);
    }
  };

  const loading = members === null && !error;
  const activeCount = (members ?? []).filter((m) => m.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Console · Identités & accès"
        title="Membres"
        description="Comptes de l'organisation : rôles, activation et mots de passe temporaires."
        actions={
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <UserRoundPlus aria-hidden="true" />
            Nouveau compte
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="mono">{(members ?? []).length} COMPTES</Chip>
        <Chip tone="green">
          <span className="kv-dot-live" aria-hidden="true" />
          {activeCount} ACTIFS
        </Chip>
        <Chip tone="mono">RBAC · ADMIN / SUPERVISEUR / MEMBRE</Chip>
      </div>

      {tempPassword ? (
        <TempPasswordAlert
          title={tempPassword.title}
          description={tempPassword.description}
          password={tempPassword.password}
          onDismiss={() => setTempPassword(null)}
        />
      ) : null}

      {error && !loading ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : members && members.length > 0 ? (
        <>
          {/* Tableau - ecrans md et plus */}
          <div className="kv-scroll hidden overflow-hidden rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/60 text-left">
                  <th className="kv-kicker px-4 py-2.5">Membre</th>
                  <th className="kv-kicker px-4 py-2.5">Rôle</th>
                  <th className="kv-kicker px-4 py-2.5">Statut</th>
                  <th className="kv-kicker px-4 py-2.5">Mot de passe</th>
                  <th className="kv-kicker px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isSelf = member.id === currentUserId;
                  return (
                    <tr key={member.id} className="border-b transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <AvatarInitials name={member.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {member.name}
                              {isSelf ? (
                                <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={member.role} />
                      </td>
                      <td className="px-4 py-3">
                        <ActiveBadge isActive={member.isActive} />
                      </td>
                      <td className="px-4 py-3">
                        {member.mustChangePassword ? <PasswordTempBadge /> : (
                          <span className="text-xs text-muted-foreground">Défini</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MemberActionsMenu
                          member={member}
                          isSelf={isSelf}
                          disabled={mutatingId === member.id}
                          onSetRole={(target) => {
                            setRoleValue(target.role);
                            setRoleTarget(target);
                          }}
                          onToggleActive={(target) => {
                            if (target.isActive) setDeactivateTarget(target);
                            else setActivateTarget(target);
                          }}
                          onResetPassword={setResetTarget}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cartes - mobile */}
          <div className="space-y-3 md:hidden">
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              return (
                <div key={member.id} className="kv-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AvatarInitials name={member.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {member.name}
                          {isSelf ? (
                            <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <MemberActionsMenu
                      member={member}
                      isSelf={isSelf}
                      disabled={mutatingId === member.id}
                      onSetRole={(target) => {
                        setRoleValue(target.role);
                        setRoleTarget(target);
                      }}
                      onToggleActive={(target) => {
                        if (target.isActive) setDeactivateTarget(target);
                        else setActivateTarget(target);
                      }}
                      onResetPassword={setResetTarget}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <RoleBadge role={member.role} />
                    <ActiveBadge isActive={member.isActive} />
                    {member.mustChangePassword ? <PasswordTempBadge /> : null}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Créé le {formatDate(member.createdAt)}
                  </p>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="Aucun membre pour le moment."
          description="Créez les comptes superviseurs et membres de l'organisation."
          action={
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <UserRoundPlus aria-hidden="true" />
              Nouveau compte
            </Button>
          }
        />
      )}

      {/* Creation */}
      <CreateMemberDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(temporaryPassword, member) => {
          setTempPassword({
            title: `Mot de passe temporaire de ${member.name}`,
            description:
              "Communiquez-le par un canal sécurisé. Il sera changé de force à la première connexion.",
            password: temporaryPassword,
          });
          load();
        }}
      />

      {/* Changement de role */}
      <Dialog
        open={roleTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRoleTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Changer le rôle</DialogTitle>
            <DialogDescription>
              {roleTarget ? `${roleTarget.name} (${roleTarget.email})` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="role-select">Nouveau rôle</Label>
            <Select value={roleValue} onValueChange={(value) => setRoleValue(value as Role)}>
              <SelectTrigger id="role-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">{ROLE_LABELS.ADMIN}</SelectItem>
                <SelectItem value="SUPERVISOR">{ROLE_LABELS.SUPERVISOR}</SelectItem>
                <SelectItem value="MEMBER">{ROLE_LABELS.MEMBER}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)} disabled={rolePending}>
              Annuler
            </Button>
            <Button onClick={handleSetRole} disabled={rolePending}>
              {rolePending ? "…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Desactivation / reactivation / reset - confirmations */}
      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        title="Désactiver ce compte ?"
        description={
          deactivateTarget
            ? `${deactivateTarget.name} (${deactivateTarget.email}) ne pourra plus se connecter ; ses sessions en cours seront refusées dès la prochaine requête.`
            : ""
        }
        confirmLabel="Désactiver"
        destructive
        pending={deactivateTarget !== null && mutatingId === deactivateTarget.id}
        onConfirm={handleDeactivate}
      />

      <ConfirmDialog
        open={activateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setActivateTarget(null);
        }}
        title="Réactiver ce compte ?"
        description={
          activateTarget
            ? `${activateTarget.name} (${activateTarget.email}) retrouvera l'accès à l'application.`
            : ""
        }
        confirmLabel="Réactiver"
        pending={activateTarget !== null && mutatingId === activateTarget.id}
        onConfirm={handleActivate}
      />

      <ConfirmDialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        title="Réinitialiser le mot de passe ?"
        description={
          resetTarget
            ? `Un nouveau mot de passe temporaire sera généré pour ${resetTarget.name} et affiché une seule fois.`
            : ""
        }
        confirmLabel="Réinitialiser"
        pending={resetTarget !== null && mutatingId === resetTarget.id}
        onConfirm={handleResetPassword}
      />
    </div>
  );
}
