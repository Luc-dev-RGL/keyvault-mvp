"use client";

// ---------------------------------------------------------------------------
// KeyVault - Journal d'audit (admin : tout le journal ; superviseur :
// uniquement les entrees liees a ses projets, spec 5.6). Lecture seule.
// Presentation "timeline" : tuile de severite + horodatage mono.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { Info, ScrollText, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionLabel, apiFetch, type AuditEntry, type Role } from "./api";
import {
  AuditActionBadge,
  AvatarInitials,
  Chip,
  EmptyState,
  ListSkeleton,
  PageHeader,
  formatDateTime,
  formatRelative,
} from "./shared";

function EntryCard({ entry }: { entry: AuditEntry }) {
  return (
    <li className="kv-card p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AuditActionBadge action={entry.action} label={actionLabel(entry.action)} />
        <time className="text-xs text-muted-foreground">
          {formatDateTime(entry.createdAt)}
        </time>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{entry.detail}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          Auteur :{" "}
          <span className="font-medium text-foreground">
            {entry.user ? entry.user.name : "Compte supprimé"}
          </span>
        </span>
        {entry.project ? (
          <span>
            Projet :{" "}
            <span className="font-medium text-foreground">{entry.project.name}</span>
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function AuditView({ role }: { role: Role }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");

  useEffect(() => {
    apiFetch<{ entries: AuditEntry[] }>("/api/audit?limit=200")
      .then((data) => setEntries(data.entries))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Chargement impossible.");
        setEntries([]);
      });
  }, []);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of entries ?? []) {
      if (entry.project) map.set(entry.project.id, entry.project.name);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "fr")
    );
  }, [entries]);

  const filtered = useMemo(() => {
    if (projectFilter === "all") return entries ?? [];
    return (entries ?? []).filter((entry) => entry.project?.id === projectFilter);
  }, [entries, projectFilter]);

  const isSupervisor = role === "SUPERVISOR";
  const loading = entries === null && !error;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Console · Traçabilité"
        title="Journal d'audit"
        description="Journal en lecture seule : les actions sensibles sont tracées, sans jamais contenir de valeur de secret."
        actions={
          <Chip tone="green">
            <ShieldCheck aria-hidden="true" />
            IMMUABLE
          </Chip>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="mono">{filtered.length} ENTRÉES</Chip>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-8 w-44 text-xs sm:w-56" aria-label="Filtrer par projet">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all">Tous les projets</SelectItem>
            {projects.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isSupervisor ? (
        <Alert className="kv-reveal border-[var(--amber-text)]/30 text-[var(--amber-text)] dark:text-[#f5c451] [&>svg]:text-[var(--amber-text)] dark:[&>svg]:text-[#f5c451]">
          <Info aria-hidden="true" />
          <AlertDescription>
            Visibilité restreinte : vous voyez les actions liées aux projets
            que vous supervisez.
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Aucune entrée d'audit."
          description={
            projects.length > 0
              ? "Aucune entrée pour ce filtre de projet."
              : "Les actions des utilisateurs apparaîtront ici."
          }
        />
      ) : (
        <>
          {/* Timeline - ecrans md et plus */}
          <div className="kv-scroll hidden md:block">
            <ol className="space-y-2">
              {filtered.map((entry) => (
                <li
                  key={entry.id}
                  className="kv-card kv-card--hover flex items-start gap-3 p-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <AuditActionBadge
                        action={entry.action}
                        label={actionLabel(entry.action)}
                      />
                      {entry.project ? <Chip tone="outline">{entry.project.name}</Chip> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.detail}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <AvatarInitials
                          name={entry.user?.name ?? "?"}
                          className="size-5 text-[9px]"
                        />
                        {entry.user ? entry.user.name : "Compte supprimé"}
                      </span>
                      <time dateTime={entry.createdAt}>
                        {formatDateTime(entry.createdAt)} · {formatRelative(entry.createdAt)}
                      </time>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Cartes - mobile */}
          <ul className="kv-scroll max-h-96 space-y-2 overflow-y-auto pr-1 md:hidden">
            {filtered.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
