"use client";

// ---------------------------------------------------------------------------
// KeyVault - composants de secrets reutilises par les projets et le coffre
// personnel. La valeur en clair n'est JAMAIS affichee dans les listes : elle
// n'apparait que le temps d'une revelation (30 s max, CA6) et la copie au
// presse-papiers la jette immediatement.
// ---------------------------------------------------------------------------

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Timer,
  Trash2,
  TriangleAlert,
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./shared";
import {
  REVEAL_SECONDS,
  apiFetch,
  isValidSecretKey,
} from "./api";

export type SecretListItem = {
  id: string;
  key: string;
  updatedAt: string;
  updatedByName?: string;
};

function formatUpdatedAt(value: string): string {
  const date = value.endsWith("Z") || value.includes("+") ? parseISO(value) : new Date(value);
  return format(date, "d MMM yyyy, HH:mm", { locale: fr });
}

// ---------------------------------------------------------------------------
// Revelation + copie : une seule valeur visible a la fois dans la liste
// ---------------------------------------------------------------------------

function useSecretReveal(revealUrlFor: (secretId: string) => string) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [value, setValue] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    // La valeur est retiree de l'etat : elle n'existe plus cote client (CA6)
    clearTimer();
    setActiveId(null);
    setValue(null);
    setSecondsLeft(0);
  }, [clearTimer]);

  const startCountdown = useCallback(
    (secretId: string) => {
      clearTimer();
      setActiveId(secretId);
      setSecondsLeft(REVEAL_SECONDS);
      timerRef.current = setInterval(() => {
        setSecondsLeft((current) => {
          if (current <= 1) {
            clearTimer();
            setActiveId(null);
            setValue(null);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    },
    [clearTimer]
  );

  // Au demontage de la liste : on efface toute valeur en clair
  useEffect(() => hide, [hide]);

  const reveal = useCallback(
    async (secretId: string) => {
      setPendingId(secretId);
      try {
        const data = await apiFetch<{ secret: { id: string; key: string; value: string } }>(
          revealUrlFor(secretId),
          { method: "POST" }
        );
        startCountdown(secretId);
        setValue(data.secret.value);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Révélation impossible.";
        toast.error(message);
      } finally {
        setPendingId(null);
      }
    },
    [revealUrlFor, startCountdown]
  );

  const copy = useCallback(
    async (secretId: string) => {
      setPendingId(secretId);
      try {
        const data = await apiFetch<{ secret: { id: string; key: string; value: string } }>(
          revealUrlFor(secretId),
          { method: "POST" }
        );
        // Ecriture au presse-papiers puis destruction immediate : la valeur
        // n'est stockee nulle part dans l'application (CA6).
        await navigator.clipboard.writeText(data.secret.value);
        toast.success("Copie dans le presse-papiers");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Copie impossible.";
        toast.error(message);
      } finally {
        setPendingId(null);
      }
    },
    [revealUrlFor]
  );

  return { activeId, value, secondsLeft, pendingId, reveal, copy, hide };
}

// ---------------------------------------------------------------------------
// Boite d'affichage temporaire d'une valeur revelee (compte a rebours 30 s)
// ---------------------------------------------------------------------------

function RevealedValueBox({
  value,
  secondsLeft,
  onHide,
}: {
  value: string;
  secondsLeft: number;
  onHide: () => void;
}) {
  const ratio = secondsLeft / REVEAL_SECONDS;
  return (
    <div className="kv-reveal p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <code className="kv-kicker min-w-0 flex-1 break-all text-[13px] font-bold normal-case tracking-normal text-foreground select-all">
          {value}
        </code>
        <Button type="button" variant="ghost" size="sm" onClick={onHide}>
          <EyeOff aria-hidden="true" />
          Masquer
        </Button>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--amber-text)] transition-[width] duration-1000 ease-linear dark:bg-[#f5c451]"
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--amber-text)] dark:text-[#f5c451]">
          <Timer className="size-3.5" aria-hidden="true" />
          Masquage automatique dans {secondsLeft} s
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actions par ligne
// ---------------------------------------------------------------------------

function RowActions({
  secretId,
  canManage,
  canReveal,
  revealed,
  pendingId,
  onReveal,
  onCopy,
  onEdit,
  onDelete,
}: {
  secretId: string;
  canManage: boolean;
  canReveal: boolean;
  revealed: boolean;
  pendingId: string | null;
  onReveal: (id: string) => void;
  onCopy: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const busy = pendingId === secretId;
  return (
    <div className="flex flex-wrap items-center justify-start gap-1 md:justify-end">
      {canReveal ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || revealed}
            onClick={() => onReveal(secretId)}
          >
            <Eye aria-hidden="true" />
            {busy ? "…" : "Révéler"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onCopy(secretId)}
          >
            <Copy aria-hidden="true" />
            {busy ? "…" : "Copier"}
          </Button>
        </>
      ) : null}
      {canManage && onEdit ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(secretId)}>
          <Pencil aria-hidden="true" />
          Modifier
        </Button>
      ) : null}
      {canManage && onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(secretId)}
        >
          <Trash2 aria-hidden="true" />
          Supprimer
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Liste complete : tableau sur grand ecran, cartes empilees sur mobile
// ---------------------------------------------------------------------------

export function SecretList({
  secrets,
  canManage,
  canReveal,
  revealUrlFor,
  onEdit,
  onDelete,
  headerAction,
}: {
  secrets: SecretListItem[];
  canManage: boolean;
  canReveal: boolean;
  revealUrlFor: (secretId: string) => string;
  onEdit?: (secretId: string) => void;
  onDelete?: (secretId: string) => void;
  headerAction?: React.ReactNode;
}) {
  const revealState = useSecretReveal(revealUrlFor);
  const hasActions = canReveal || canManage;

  return (
    <div className="space-y-3">
      {headerAction ? <div className="flex justify-end">{headerAction}</div> : null}

      {/* Tableau - ecrans md et plus */}
      <div className="kv-scroll hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60 text-left">
              <th className="kv-kicker px-4 py-2.5">Clé</th>
              <th className="kv-kicker px-4 py-2.5">Mise à jour</th>
              {hasActions ? (
                <th className="kv-kicker px-4 py-2.5 text-right">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {secrets.map((secret) => {
              const isRevealed =
                revealState.activeId === secret.id && revealState.value !== null;
              return (
                <FragmentRow
                  key={secret.id}
                  secret={secret}
                  isRevealed={isRevealed}
                  revealedValue={isRevealed ? revealState.value! : null}
                  secondsLeft={revealState.secondsLeft}
                  canManage={canManage}
                  canReveal={canReveal}
                  pendingId={revealState.pendingId}
                  onReveal={revealState.reveal}
                  onCopy={revealState.copy}
                  onHide={revealState.hide}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cartes - mobile */}
      <div className="space-y-3 md:hidden">
        {secrets.map((secret) => {
          const isRevealed =
            revealState.activeId === secret.id && revealState.value !== null;
          return (
            <div key={secret.id} className="kv-card p-4">
              <p className="kv-kicker break-all text-[12.5px] font-bold normal-case tracking-normal text-foreground">
                {secret.key}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Mise à jour : {formatUpdatedAt(secret.updatedAt)}
                {secret.updatedByName ? ` · ${secret.updatedByName}` : ""}
              </p>
              <div className="mt-3">
                <RowActions
                  secretId={secret.id}
                  canManage={canManage}
                  canReveal={canReveal}
                  revealed={isRevealed}
                  pendingId={revealState.pendingId}
                  onReveal={revealState.reveal}
                  onCopy={revealState.copy}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
              {isRevealed && revealState.value !== null ? (
                <div className="mt-3">
                  <RevealedValueBox
                    value={revealState.value}
                    secondsLeft={revealState.secondsLeft}
                    onHide={revealState.hide}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Ligne de tableau + ligne de revelation eventuelle sous la cle
function FragmentRow({
  secret,
  isRevealed,
  revealedValue,
  secondsLeft,
  canManage,
  canReveal,
  pendingId,
  onReveal,
  onCopy,
  onHide,
  onEdit,
  onDelete,
}: {
  secret: SecretListItem;
  isRevealed: boolean;
  revealedValue: string | null;
  secondsLeft: number;
  canManage: boolean;
  canReveal: boolean;
  pendingId: string | null;
  onReveal: (id: string) => void;
  onCopy: (id: string) => void;
  onHide: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const hasActions = canReveal || canManage;
  return (
    <Fragment key={secret.id}>
      <tr className={cn("border-b transition-colors", isRevealed && "bg-[var(--amber-tint)]/40")}>
        <td className="px-4 py-3">
          <p className="kv-kicker break-all text-[12.5px] font-bold normal-case tracking-normal text-foreground">
            {secret.key}
          </p>
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {formatUpdatedAt(secret.updatedAt)}
          {secret.updatedByName ? (
            <span className="block text-xs">par {secret.updatedByName}</span>
          ) : null}
        </td>
        {hasActions ? (
          <td className="px-4 py-3">
            <RowActions
              secretId={secret.id}
              canManage={canManage}
              canReveal={canReveal}
              revealed={isRevealed}
              pendingId={pendingId}
              onReveal={onReveal}
              onCopy={onCopy}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </td>
        ) : null}
      </tr>
      {isRevealed && revealedValue !== null ? (
        <tr className="border-b">
          <td colSpan={hasActions ? 3 : 2} className="px-4 py-3">
            <RevealedValueBox value={revealedValue} secondsLeft={secondsLeft} onHide={onHide} />
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

// ---------------------------------------------------------------------------
// Formulaire d'ajout / modification d'un secret (projet ou coffre personnel)
// Validation client du format de cle (spec 5.4) + erreurs serveur affichees
// ---------------------------------------------------------------------------

export function SecretFormDialog({
  open,
  onOpenChange,
  mode,
  initialKey,
  submitLabel,
  description,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialKey?: string;
  submitLabel: string;
  description: string;
  onSubmit: (data: { key: string; value: string | null }) => Promise<void>;
}) {
  const [key, setKey] = useState(initialKey ?? "");
  const [value, setValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Reinitialisation a l'ouverture (cle pre-remplie en edition)
  useEffect(() => {
    if (open) {
      setKey(initialKey ?? "");
      setValue("");
      setFormError(null);
      setPending(false);
    }
  }, [open, initialKey]);

  const handleSubmit = async () => {
    setFormError(null);

    if (!isValidSecretKey(key)) {
      setFormError(
        "Format de clé invalide : lettres, chiffres et underscores uniquement, en commençant par une lettre ou un underscore (exemple : MA_CLE)."
      );
      return;
    }
    if (mode === "create" && value.trim().length === 0) {
      setFormError("La valeur du secret est obligatoire.");
      return;
    }

    setPending(true);
    try {
      await onSubmit({ key: key.trim(), value: value.trim().length > 0 ? value : null });
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{submitLabel}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secret-key">Clé</Label>
            <Input
              id="secret-key"
              className="font-mono"
              placeholder="MA_CLE"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              disabled={pending}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secret-value">
              {mode === "create" ? "Valeur" : "Nouvelle valeur (optionnelle)"}
            </Label>
            <Textarea
              id="secret-value"
              className="min-h-24 font-mono"
              placeholder={
                mode === "edit"
                  ? "Laisser vide pour conserver la valeur actuelle"
                  : "Valeur du secret"
              }
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={pending}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {formError ? (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? "…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Bouton "Ajouter un secret" (raccourci partage)
// ---------------------------------------------------------------------------

export function AddSecretButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="sm" onClick={onClick}>
      <Plus aria-hidden="true" />
      Ajouter un secret
    </Button>
  );
}
