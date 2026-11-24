import type { Project, User } from "@prisma/client";
import { db } from "@/lib/db";

// Controle d'acces centralise par projet (spec 4.2 - matrice des permissions)
//
// Definitions :
// - isAdmin          : role global ADMIN
// - isSupervisor     : superviseur DESIGNÉ de ce projet (Project.supervisorId)
// - isMember         : assigne explicitement au projet (ProjectMembership)
//
// Droits resultants :
// - canView          : voir le projet et la liste des cles (masquees)
// - canManageSecrets : ajouter / modifier / supprimer des secrets
// - canManageMembers : assigner / retirer des membres
// - canReveal        : reveler / exporter les valeurs.
//                      ATTENTION : le role ADMIN seul ne donne PAS ce droit
//                      (moindre privilege, spec 6.3, critere CA3) : un admin
//                      non assigne ne peut pas dechiffrer les secrets du projet.
//                      Un admin assigne passe par isMember.
export interface ProjectAccess {
  project: Project;
  isAdmin: boolean;
  isSupervisor: boolean;
  isMember: boolean;
  canView: boolean;
  canManageSecrets: boolean;
  canManageMembers: boolean;
  canReveal: boolean;
}

export async function getProjectAccess(
  user: User,
  projectId: string
): Promise<ProjectAccess | null> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  const membership = await db.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });

  const isAdmin = user.role === "ADMIN";
  const isSupervisor = project.supervisorId === user.id;
  const isMember = Boolean(membership);

  return {
    project,
    isAdmin,
    isSupervisor,
    isMember,
    canView: isAdmin || isSupervisor || isMember,
    canManageSecrets: isAdmin || isSupervisor,
    canManageMembers: isAdmin || isSupervisor,
    // Moindre privilege : jamais "isAdmin" seul ici (CA3)
    canReveal: isSupervisor || isMember,
  };
}
