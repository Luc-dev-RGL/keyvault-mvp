"use client";

// ---------------------------------------------------------------------------
// KeyVault - Application mono-page (aucune autre route) :
// 1. GET /api/auth/me au montage -> connexion / changement force / app
// 2. Gestion globale du 401 : session expiree -> retour a la connexion
// 3. Coquille "console SEC-OPS" : barre laterale fixe (desktop) avec badges
//    mono, fil d'Ariane + recherche dans l'en-tete, menu utilisateur ;
//    mobile : tiroir lateral + nav compacte. Pied de page colle en bas.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronsRight,
  FolderKanban,
  KeyRound,
  LogOut,
  Menu,
  ScrollText,
  ShieldCheck,
  Users,
  Vault,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  apiFetch,
  setUnauthorizedHandler,
  type ProjectSummary,
  type KvUser,
  type Role,
} from "@/components/kv/api";
import { AvatarInitials, RoleBadge } from "@/components/kv/shared";
import { LoginView } from "@/components/kv/LoginView";
import { ForcePasswordChangeView } from "@/components/kv/ForcePasswordChangeView";
import { ProjectsView } from "@/components/kv/ProjectsView";
import { ProjectDetailView } from "@/components/kv/ProjectDetailView";
import { MembersView } from "@/components/kv/MembersView";
import { MonEspaceView } from "@/components/kv/MonEspaceView";
import { AuditView } from "@/components/kv/AuditView";

type AuthState = "loading" | "anonymous" | "forced" | "ready";
type ViewKey = "projects" | "project" | "members" | "me" | "audit";

type NavItem = {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  mono?: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "projects",
    label: "Projets",
    icon: FolderKanban,
    roles: ["ADMIN", "SUPERVISOR", "MEMBER"],
    mono: "COFFRES",
  },
  {
    key: "members",
    label: "Membres",
    icon: Users,
    roles: ["ADMIN"],
    mono: "RBAC",
  },
  {
    key: "audit",
    label: "Audit",
    icon: ScrollText,
    roles: ["ADMIN", "SUPERVISOR"],
    mono: "IMMUTABLE",
  },
  {
    key: "me",
    label: "Mon espace",
    icon: ShieldCheck,
    roles: ["ADMIN", "SUPERVISOR", "MEMBER"],
    mono: "PRIVÉ",
  },
];

function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

const VIEW_TITLES: Record<ViewKey, string> = {
  projects: "Projets",
  project: "Coffre du projet",
  members: "Membres",
  me: "Mon espace",
  audit: "Journal d'audit",
};

// ---------------------------------------------------------------------------
// Barre laterale (partagee desktop / tiroir mobile)
// ---------------------------------------------------------------------------

function Sidebar({
  user,
  viewKey,
  onNavigate,
  mobileOpen = false,
  onCloseMobile,
}: {
  user: KvUser;
  viewKey: ViewKey;
  onNavigate: (key: ViewKey) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const items = navItemsForRole(user.role);

  const body = (
    <div className="flex h-full flex-col">
      {/* Marque */}
      <div className="flex items-center gap-2.5 border-b px-4 py-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand-strong)] dark:bg-[var(--accent)] dark:text-[var(--accent-foreground)]">
          <Vault className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold tracking-tight">KeyVault</p>
          <p className="kv-kicker">Console · SEC-OPS</p>
        </div>
        {onCloseMobile ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 lg:hidden"
            onClick={onCloseMobile}
            aria-label="Fermer le menu"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navigation principale">
        {items.map((item) => {
          const active = viewKey === item.key || (viewKey === "project" && item.key === "projects");
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className="kv-nav-item"
              data-active={active}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                onNavigate(item.key);
                onCloseMobile?.();
              }}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.mono ? <span className="kv-chip kv-chip--mono">{item.mono}</span> : null}
            </button>
          );
        })}
      </nav>

      {/* Etat systeme */}
      <div className="space-y-2 border-t px-4 py-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="kv-dot-live" aria-hidden="true" />
          Système opérationnel
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="kv-chip kv-chip--mono">AES-256-GCM</span>
          <span className="kv-chip kv-chip--mono">AUDIT ACTIF</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop : colonne fixe (jamais rendue pour l'instance tiroir mobile) */}
      {!mobileOpen ? (
        <aside
          className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-card lg:block"
          aria-label="Navigation principale"
        >
          {body}
        </aside>
      ) : null}

      {/* Mobile : tiroir */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Fermer le menu"
            onClick={onCloseMobile}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r bg-card shadow-xl">
            {body}
          </div>
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Coquille applicative : sidebar + colonne de contenu (topbar, vues, footer)
// ---------------------------------------------------------------------------

function AppShell({
  user,
  viewKey,
  transitionKey,
  onNavigate,
  onLogout,
  children,
}: {
  user: KvUser;
  viewKey: ViewKey;
  transitionKey: string;
  onNavigate: (key: ViewKey) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={user}
        viewKey={viewKey}
        onNavigate={onNavigate}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tete : menu mobile + fil d'Ariane + identite */}
        <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="flex h-14 items-center gap-3 px-4 md:px-6">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-4" aria-hidden="true" />
            </Button>

            {/* Fil d'Ariane */}
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="hidden text-muted-foreground sm:inline">Organisation</span>
              <ChevronsRight className="hidden size-3.5 text-muted-foreground sm:inline" aria-hidden="true" />
              <span className="truncate font-semibold">
                {viewKey === "project" ? "Coffre du projet" : VIEW_TITLES[viewKey]}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              {/* Identite */}
              <div className="hidden items-center gap-2.5 sm:flex">
                <div className="text-right leading-tight">
                  <p className="max-w-44 truncate text-sm font-semibold">{user.name}</p>
                  <p className="max-w-44 truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <AvatarInitials name={user.name} />
              </div>
              <RoleBadge role={user.role} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLogout}
                aria-label="Se déconnecter"
              >
                <LogOut aria-hidden="true" />
                <span className="hidden md:inline">Quitter</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex flex-1 flex-col px-4 py-6 md:px-6 md:py-8">
          <div className="kv-scroll mx-auto w-full max-w-6xl flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={transitionKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pied de page colle en bas (mt-auto), respecte les safe areas */}
          <footer className="mt-auto pb-[max(env(safe-area-inset-bottom),0px)] pt-10 text-xs text-muted-foreground">
            <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2">
              <span>
                KeyVault — variables d&apos;environnement chiffrées (AES-256-GCM),
                accès par projet, journal d&apos;audit immuable.
              </span>
              <span className="kv-chip kv-chip--mono">CA1 → CA12</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page racine : machine a etats d'authentification + routage de vues
// ---------------------------------------------------------------------------

export default function Page() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<KvUser | null>(null);
  const [viewKey, setViewKey] = useState<ViewKey>("projects");
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);

  const resetToAnonymous = useCallback(() => {
    setUser(null);
    setSelectedProject(null);
    setViewKey("projects");
    setAuthState("anonymous");
  }, []);

  // Enregistrement du gestionnaire global 401 (session expiree / compte
  // desactive pendant l'utilisation : on revient a la connexion).
  useEffect(() => {
    setUnauthorizedHandler(resetToAnonymous);
    return () => setUnauthorizedHandler(null);
  }, [resetToAnonymous]);

  const loadMe = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: KvUser }>("/api/auth/me");
      setUser(data.user);
      setAuthState(data.user.mustChangePassword ? "forced" : "ready");
      if (data.user.mustChangePassword) {
        setViewKey("projects");
        setSelectedProject(null);
      }
    } catch {
      resetToAnonymous();
    }
  }, [resetToAnonymous]);

  useEffect(() => {
    const timer = setTimeout(loadMe, 0);
    return () => clearTimeout(timer);
  }, [loadMe]);

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Peu importe : on reinitialise l'interface dans tous les cas
    }
    resetToAnonymous();
  }, [resetToAnonymous]);

  const handleLogin = useCallback((loggedIn: KvUser) => {
    setUser(loggedIn);
    setViewKey("projects");
    setSelectedProject(null);
    setAuthState(loggedIn.mustChangePassword ? "forced" : "ready");
  }, []);

  // ------------------------------------------------------------------
  // Rendus selon l'etat d'authentification
  // ------------------------------------------------------------------

  if (authState === "loading") {
    return (
      <main className="kv-grid-bg flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <span className="flex size-14 animate-pulse items-center justify-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand-strong)]">
            <Vault className="size-7" aria-hidden="true" />
          </span>
          <div className="text-center">
            <p className="text-sm font-semibold">Chargement de KeyVault…</p>
            <p className="kv-kicker mt-1">Vérification de la session</p>
          </div>
        </div>
      </main>
    );
  }

  if (authState === "anonymous" || !user) {
    return <LoginView onLoggedIn={handleLogin} />;
  }

  if (authState === "forced" || user.mustChangePassword) {
    return (
      <ForcePasswordChangeView
        user={user}
        onPasswordChanged={() => {
          loadMe();
        }}
        onLogout={handleLogout}
      />
    );
  }

  // ------------------------------------------------------------------
  // Application
  // ------------------------------------------------------------------

  const canAccess = (key: ViewKey): boolean => {
    const item = NAV_ITEMS.find((navItem) => navItem.key === key);
    return item ? item.roles.includes(user.role) : false;
  };

  let content: React.ReactNode = null;
  if (viewKey === "project" && selectedProject) {
    content = (
      <ProjectDetailView
        projectId={selectedProject.id}
        summary={selectedProject}
        currentUser={user}
        onBack={() => setViewKey("projects")}
        onDeleted={() => {
          setSelectedProject(null);
          setViewKey("projects");
        }}
      />
    );
  } else if (viewKey === "members" && canAccess("members")) {
    content = <MembersView currentUserId={user.id} />;
  } else if (viewKey === "audit" && canAccess("audit")) {
    content = <AuditView role={user.role} />;
  } else if (viewKey === "me") {
    content = (
      <MonEspaceView
        user={user}
        onUserUpdated={() => {
          loadMe();
        }}
      />
    );
  } else {
    content = (
      <ProjectsView
        isAdmin={user.role === "ADMIN"}
        onOpenProject={(project) => {
          setSelectedProject(project);
          setViewKey("project");
        }}
      />
    );
  }

  return (
    <AppShell
      user={user}
      viewKey={viewKey}
      transitionKey={
        viewKey === "project" ? `project-${selectedProject?.id ?? ""}` : viewKey
      }
      onNavigate={(key) => {
        setViewKey(key);
        if (key !== "project") setSelectedProject(null);
      }}
      onLogout={handleLogout}
    >
      {content}
    </AppShell>
  );
}
