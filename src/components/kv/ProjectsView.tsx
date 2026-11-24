"use client";

// ---------------------------------------------------------------------------
// KeyVault - Vue Projets : grille de cartes coffres + creation (admin)
// Etat vide bienveillant (CA12) et chargement en squelettes.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import {
  ArrowRight,
  FolderKanban,
  KeyRound,
  Plus,
  UserRound,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, type DirectoryUser, type ProjectSummary, type Role } from "./api";
import {
  CardGridSkeleton,
  Chip,
  CountPill,
  EmptyState,
  PageHeader,
  Tile,
} from "./shared";

const CARD_TONES = ["blue", "teal", "purple", "green", "amber"] as const;

function ProjectCard({
  project,
  index,
  onOpen,
}: {
  project: ProjectSummary;
  index: number;
  onOpen: (project: ProjectSummary) => void;
}) {
  const tone = CARD_TONES[index % CARD_TONES.length];
  return (
    <button
      type="button"
      onClick={() => onOpen(project)}
      className="kv-card kv-card--hover group flex h-full flex-col p-5 text-left focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`Ouvrir le coffre du projet ${project.name}`}
    >
      <div className="flex items-start gap-3">
        <Tile icon={FolderKanban} tone={tone} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{project.name}</h3>
          <p className="kv-kicker mt-0.5 truncate">
            {project.supervisor ? `SUPERVISÉ PAR ${project.supervisor.name.toUpperCase()}` : "SUPERVISEUR NON DÉSIGNÉ"}
          </p>
        </div>
        <ArrowRight
          className="size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-[var(--brand-strong)] dark:group-hover:text-[var(--accent-foreground)]"
          aria-hidden="true"
        />
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {project.description || "Aucune description."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CountPill icon={KeyRound} label="secrets" value={project._count.secrets} />
        <CountPill icon={Users} label="membres" value={project._count.members} />
        <Chip tone="mono" className="ml-auto">OUVRIR LE COFFRE</Chip>
      </div>
    </button>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: ProjectSummary) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [users, setUsers] = useState<DirectoryUser[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Annuaire charge a l'ouverture du dialog
  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setSupervisorId("");
    setError(null);
    setLoadingUsers(true);
    apiFetch<{ users: DirectoryUser[] }>("/api/members/directory")
      .then((data) => setUsers(data.users))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Annuaire indisponible.");
        setUsers([]);
      })
      .finally(() => setLoadingUsers(false));
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    if (name.trim().length === 0) {
      setError("Le nom du projet est obligatoire.");
      return;
    }
    if (!supervisorId) {
      setError("Choisissez un superviseur pour le projet.");
      return;
    }

    setPending(true);
    try {
      const data = await apiFetch<{ project: ProjectSummary }>("/api/projects", {
        method: "POST",
        body: {
          name: name.trim(),
          description: description.trim(),
          supervisorId,
        },
      });
      toast.success("Projet créé.");
      onCreated(data.project);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setPending(false);
    }
  };

  const roleLabel: Record<Role, string> = {
    ADMIN: "administrateur",
    SUPERVISOR: "superviseur",
    MEMBER: "membre",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau coffre de projet</DialogTitle>
          <DialogDescription>
            Nommez le projet et désignez le superviseur responsable de ses
            secrets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Nom du projet</Label>
            <Input
              id="project-name"
              placeholder="Application facturation"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="Contexte du projet, environnements concernés…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={pending}
              maxLength={500}
              className="min-h-20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-supervisor">Superviseur</Label>
            <Select
              value={supervisorId}
              onValueChange={setSupervisorId}
              disabled={pending || loadingUsers}
            >
              <SelectTrigger id="project-supervisor" className="w-full">
                <SelectValue
                  placeholder={loadingUsers ? "Chargement…" : "Choisir un superviseur"}
                />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {(users ?? []).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({roleLabel[user.role]})
                  </SelectItem>
                ))}
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
          <Button onClick={handleSubmit} disabled={pending || loadingUsers}>
            {pending ? "Création…" : "Créer le coffre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsView({
  isAdmin,
  onOpenProject,
}: {
  isAdmin: boolean;
  onOpenProject: (project: ProjectSummary) => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    try {
      const data = await apiFetch<{ projects: ProjectSummary[] }>("/api/projects");
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
      setProjects([]);
    }
  };

  // Chargement initial diffe d'un tick : evite un appel de setState
  // synchrone dans le corps de l'effet (react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, []);

  const loading = projects === null && !error;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Console · Coffres de l'organisation"
        title="Projets"
        description="Les coffres de secrets partagés auxquels vous avez accès. Chaque valeur est chiffrée et journalisée."
        actions={
          isAdmin ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              Nouveau coffre
            </Button>
          ) : undefined
        }
      />

      {error && !loading ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <CardGridSkeleton />
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={index}
              onOpen={onOpenProject}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="Aucun coffre pour le moment."
          description={
            isAdmin
              ? "Créez un premier coffre et désignez un superviseur pour organiser vos secrets."
              : "Les coffres auxquels vous serez assigné apparaîtront ici."
          }
          action={
            isAdmin ? (
              <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden="true" />
                Nouveau coffre
              </Button>
            ) : undefined
          }
        />
      )}

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(project) => {
          setProjects((current) =>
            current
              ? [...current, { ...project, _count: { secrets: 0, members: 0 } }].sort(
                  (a, b) => a.name.localeCompare(b.name)
                )
              : [project]
          );
        }}
      />
    </div>
  );
}
