"use client";

// ---------------------------------------------------------------------------
// KeyVault — briques d'interface partagees (style console Fluent blanc)
// Toutes les vues composent avec : chips de statut, tuiles d'icone,
// en-tetes de page avec kicker mono, cartes de statistiques.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ROLE_LABELS,
  actionTone,
  type ActionTone,
  type Role,
} from "./api";

// ---------------------------------------------------------------------------
// Dates (formatees en francais)
// ---------------------------------------------------------------------------

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return value.endsWith("Z") || value.includes("+") ? parseISO(value) : new Date(value);
}

export function formatDateTime(value: string | Date): string {
  return format(toDate(value), "d MMM yyyy 'à' HH:mm", { locale: fr });
}

export function formatDate(value: string | Date): string {
  return format(toDate(value), "d MMMM yyyy", { locale: fr });
}

/** Temps relatif compact : "il y a 12 min", "il y a 3 h", "il y a 2 j". */
export function formatRelative(value: string | Date): string {
  return `il y a ${formatDistanceToNowStrict(toDate(value), { locale: fr })}`;
}

// ---------------------------------------------------------------------------
// Initiales pour avatars (teinte derivee du nom)
// ---------------------------------------------------------------------------

const AVATAR_TONES = ["blue", "teal", "purple", "green", "amber"] as const;

export function AvatarInitials({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const hash = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
        tone === "blue" && "bg-[var(--brand-tint)] text-[var(--brand-strong)] dark:text-[#6cb8f6]",
        tone === "teal" && "bg-[var(--teal-tint)] text-[var(--teal)] dark:text-[#32bdb0]",
        tone === "purple" && "bg-[var(--purple-tint)] text-[#6b4fa0] dark:text-[#a68fd4]",
        tone === "green" && "bg-[var(--green-tint)] text-[var(--green)] dark:text-[#6bbf59]",
        tone === "amber" && "bg-[var(--amber-tint)] text-[var(--amber-text)] dark:text-[#f5c451]",
        className
      )}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Chip de statut (palette Fluent : blue / green / amber / red / teal / mono)
// ---------------------------------------------------------------------------

export type ChipTone =
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "teal"
  | "purple"
  | "outline"
  | "mono";

export function Chip({
  tone = "outline",
  children,
  className,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "kv-chip",
        tone === "blue" && "kv-chip--blue",
        tone === "green" && "kv-chip--green",
        tone === "amber" && "kv-chip--amber",
        tone === "red" && "kv-chip--red",
        tone === "teal" && "kv-chip--teal",
        tone === "purple" && "kv-chip--purple",
        tone === "mono" && "kv-chip--mono",
        className
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tuile d'icone carree
// ---------------------------------------------------------------------------

export function Tile({
  icon: Icon,
  tone = "blue",
  className,
}: {
  icon: LucideIcon;
  tone?: "blue" | "green" | "amber" | "red" | "teal" | "purple" | "neutral";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "kv-tile",
        tone !== "neutral" && `kv-tile--${tone}`,
        className
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// En-tete de page : kicker mono + titre + description + actions
// ---------------------------------------------------------------------------

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {kicker ? <p className="kv-kicker">{kicker}</p> : null}
        <h1 className="flex flex-wrap items-center gap-2.5 text-xl font-semibold tracking-tight md:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte de statistique (rangée de chiffres cles)
// ---------------------------------------------------------------------------

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="kv-card flex items-center gap-3 p-4">
      <Tile icon={Icon} />
      <div className="min-w-0">
        <p className="kv-kicker">{label}</p>
        <p className="mt-0.5 text-lg font-semibold leading-tight">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges de role / activation (conformes a la matrice RBAC)
// ---------------------------------------------------------------------------

export function RoleBadge({ role }: { role: Role }) {
  if (role === "ADMIN") {
    return <Chip tone="blue">{ROLE_LABELS[role]}</Chip>;
  }
  if (role === "SUPERVISOR") {
    return <Chip tone="amber">{ROLE_LABELS[role]}</Chip>;
  }
  return <Chip tone="teal">{ROLE_LABELS[role]}</Chip>;
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return (
      <Chip tone="green">
        <span className="kv-dot-live" aria-hidden="true" />
        Actif
      </Chip>
    );
  }
  return <Chip tone="red">Désactivé</Chip>;
}

const TONE_CHIP: Record<ActionTone, ChipTone> = {
  neutral: "outline",
  success: "green",
  warning: "amber",
  danger: "red",
  info: "blue",
};

export function AuditActionBadge({
  action,
  label,
}: {
  action: string;
  label: string;
}) {
  return (
    <Chip tone={TONE_CHIP[actionTone(action)]} className="max-w-full">
      <span className="truncate">{label}</span>
    </Chip>
  );
}

// ---------------------------------------------------------------------------
// Titre de section avec icone (niveau carte / onglet)
// ---------------------------------------------------------------------------

export function SectionHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Tile icon={Icon} />
        <div>
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etat vide
// ---------------------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <span className="flex size-13 items-center justify-center rounded-xl bg-[var(--brand-tint)] p-3 text-[var(--brand-strong)]">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lien "retour" discret
// ---------------------------------------------------------------------------

export function BackLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-[var(--brand-strong)] dark:hover:text-[#6cb8f6]"
    >
      <ArrowRight className="size-3.5 rotate-180" aria-hidden="true" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Squelettes de chargement
// ---------------------------------------------------------------------------

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="kv-card space-y-3 p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-5 w-2/3" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boite de dialogue de confirmation (AlertDialog controlee)
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Mot de passe temporaire affiche UNE SEULE FOIS (CA7 / CA8)
// ---------------------------------------------------------------------------

export function TempPasswordAlert({
  title,
  description,
  password,
  onDismiss,
}: {
  title: string;
  description: string;
  password: string;
  onDismiss: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Copie dans le presse-papiers");
    } catch {
      toast.error("Copie impossible. Sélectionnez le mot de passe manuellement.");
    }
  };

  return (
    <div className="kv-reveal p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-[var(--amber-text)] dark:text-[#f5c451]"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-[var(--amber-text)] dark:text-[#f5c451]">
            {title}
          </p>
          <p className="text-sm text-[var(--amber-text)]/90 dark:text-[#f5c451]/80">
            {description}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="kv-kicker block break-all rounded-md border bg-background px-3 py-2 text-[13px] font-bold normal-case tracking-normal text-foreground select-all">
              {password}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copy}>
              <Copy aria-hidden="true" />
              Copier
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              Fermer
            </Button>
          </div>
          <p className="text-xs text-[var(--amber-text)]/80 dark:text-[#f5c451]/70">
            Ce mot de passe ne sera plus jamais affiché.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Petites pastilles de comptage (projets)
// ---------------------------------------------------------------------------

export function CountPill({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Chip tone="outline">
      <Icon className="size-3" aria-hidden="true" />
      <span className="font-bold">{value}</span>
      {label}
    </Chip>
  );
}

export function SuccessDot({ className }: { className?: string }) {
  return <span className={cn("kv-dot-live", className)} aria-hidden="true" />;
}
