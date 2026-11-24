// ---------------------------------------------------------------------------
// KeyVault - Helper de requetes API cote client + types de contrat
// Toutes les URLs sont RELATIVES (pas d'URL absolue, pas de port explicite).
// Les erreurs serveur arrivent sous la forme { error: string } : on les
// transforme en ApiError { status, message } reutilisables partout.
// ---------------------------------------------------------------------------

export type Role = "ADMIN" | "SUPERVISOR" | "MEMBER";

export type KvUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  supervisorId?: string;
  createdById?: string;
  createdAt: string;
  supervisor: { id: string; name: string } | null;
  _count: { secrets: number; members: number };
};

export type MyAccess = {
  isAdmin: boolean;
  isSupervisor: boolean;
  isMember: boolean;
  canManageSecrets: boolean;
  canManageMembers: boolean;
  canReveal: boolean;
};

export type ProjectSecret = {
  id: string;
  key: string;
  updatedAt: string;
  updatedBy?: { name: string };
};

export type ProjectMember = {
  userId: string;
  createdAt: string;
  user: { id: string; name: string; email: string; isActive: boolean };
};

export type ProjectDetail = {
  project: {
    id: string;
    name: string;
    description: string;
    supervisor: { id: string } | null;
    createdAt: string;
  };
  secrets: ProjectSecret[];
  members?: ProjectMember[];
  myAccess: MyAccess;
};

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type AdminMember = KvUser & { _count: { memberships: number } };

export type PersonalSecret = {
  id: string;
  key: string;
  updatedAt: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
  project: { id: string; name: string } | null;
};

export type ActivityEntry = {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  project: { id: string; name: string } | null;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Gestion globale du 401 : toute reponse 401 recue alors que l'utilisateur
// est connecte (session expiree, compte desactive) ramene a l'ecran de
// connexion. page.tsx enregistre le callback au montage.
// ---------------------------------------------------------------------------
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function readErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error: unknown }).error;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

type ApiFetchOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function apiFetch<T>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { body, ...restOptions } = options;
  const init: RequestInit = { ...restOptions, cache: "no-store" };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    };
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(0, "Impossible de contacter le serveur.");
  }

  if (!response.ok) {
    let message = `Erreur ${response.status}.`;
    try {
      const payload = await response.json();
      message = readErrorMessage(payload) ?? message;
    } catch {
      // Corps non JSON : on garde le message par defaut
    }
    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// Telechargement de fichier binaire / texte (export .env) avec la meme
// gestion des erreurs JSON et du 401 global.
export async function apiDownload(url: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new ApiError(0, "Impossible de contacter le serveur.");
  }

  if (!response.ok) {
    let message = `Erreur ${response.status}.`;
    try {
      const payload = await response.json();
      message = readErrorMessage(payload) ?? message;
    } catch {
      // Corps non JSON : message par defaut
    }
    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    throw new ApiError(response.status, message);
  }

  return response;
}

// ---------------------------------------------------------------------------
// Helpers partages
// ---------------------------------------------------------------------------

// Format des clés de variables d'environnement (spec 5.4)
export const SECRET_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidSecretKey(key: string): boolean {
  return SECRET_KEY_REGEX.test(key);
}

// Libellés français des actions du journal d'audit.
// Action inconnue -> on retombe sur le libellé brut du serveur.
const ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN: "Connexion",
  AUTH_LOGIN_FAILED: "Échec de connexion",
  AUTH_LOGOUT: "Déconnexion",
  PASSWORD_CHANGED: "Mot de passe modifié",
  PASSWORD_RESET: "Mot de passe réinitialisé",
  USER_CREATED: "Compte créé",
  USER_UPDATED: "Compte modifié",
  USER_DEACTIVATED: "Compte désactivé",
  PROJECT_CREATED: "Projet créé",
  PROJECT_DELETED: "Projet supprimé",
  MEMBER_ASSIGNED: "Membre assigné",
  MEMBER_REMOVED: "Membre retiré",
  SECRET_CREATED: "Secret ajouté",
  SECRET_UPDATED: "Secret modifié",
  SECRET_DELETED: "Secret supprimé",
  SECRET_REVEALED: "Secret révélé",
  ENV_EXPORTED: "Export .env",
  PERSONAL_SECRET_CREATED: "Secret personnel ajouté",
  PERSONAL_SECRET_UPDATED: "Secret personnel modifié",
  PERSONAL_SECRET_DELETED: "Secret personnel supprimé",
  PERSONAL_SECRET_REVEALED: "Secret personnel révélé",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// Categorie d'action pour la couleur des badges d'audit.
export type ActionTone = "neutral" | "success" | "warning" | "danger" | "info";

export function actionTone(action: string): ActionTone {
  if (action.endsWith("_DELETED") || action === "USER_DEACTIVATED") {
    return "danger";
  }
  if (action.endsWith("_REVEALED") || action === "ENV_EXPORTED") {
    return "warning";
  }
  if (
    action.endsWith("_CREATED") ||
    action === "MEMBER_ASSIGNED" ||
    action === "PASSWORD_CHANGED"
  ) {
    return "success";
  }
  if (action.startsWith("AUTH_")) {
    return "info";
  }
  return "neutral";
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  SUPERVISOR: "Superviseur",
  MEMBER: "Membre",
};

// Compteur de masquage automatique des valeurs révélées (CA6)
export const REVEAL_SECONDS = 30;
