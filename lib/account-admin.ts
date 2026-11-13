import { StudioRole } from "@prisma/client";

export const ASSIGNABLE_ROLES: StudioRole[] = ["EDITOR", "REVIEWER", "ADMIN", "SUPERADMIN"];

export type AccountActor = { id: string; role: StudioRole };
export type AccountTarget = { id: string; role: StudioRole; active: boolean };
export type AccountChanges = { name?: string; role?: StudioRole; active?: boolean };

export class AccountPolicyError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AccountPolicyError";
    this.status = status;
  }
}

export function isAssignableRole(value: unknown): value is StudioRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as string[]).includes(value);
}

/** Only a SUPERADMIN may assign SUPERADMIN or change a SUPERADMIN's role. */
export function canAssignRole(actorRole: StudioRole, currentRole: StudioRole, nextRole: StudioRole): boolean {
  if (!isAssignableRole(nextRole)) return false;
  const involvesSuperadmin = currentRole === "SUPERADMIN" || nextRole === "SUPERADMIN";
  if (involvesSuperadmin) return actorRole === "SUPERADMIN";
  return actorRole === "SUPERADMIN" || actorRole === "ADMIN";
}

function isActiveSuperadmin(user: AccountTarget): boolean {
  return user.role === "SUPERADMIN" && user.active;
}

/**
 * Returns an error message when a mutation is not allowed.
 * Guards: only SUPERADMIN may grant/remove SUPERADMIN; cannot demote or
 * deactivate the last active SUPERADMIN; cannot deactivate yourself.
 */
export function accountMutationError(
  actor: AccountActor,
  target: AccountTarget,
  changes: AccountChanges,
  activeSuperadminCount: number
): string | null {
  if (actor.role !== "SUPERADMIN") return "Forbidden";
  const nextRole = changes.role ?? target.role;
  const nextActive = changes.active ?? target.active;
  const roleChanging = changes.role !== undefined && changes.role !== target.role;
  const activeChanging = changes.active !== undefined && changes.active !== target.active;

  if (roleChanging && !canAssignRole(actor.role, target.role, nextRole)) {
    return isAssignableRole(nextRole) && (target.role === "SUPERADMIN" || nextRole === "SUPERADMIN")
      ? "Only a superadmin can assign or remove the superadmin role"
      : "Invalid role";
  }

  const targetIsLastActiveSuperadmin = isActiveSuperadmin(target) && activeSuperadminCount <= 1;
  if (targetIsLastActiveSuperadmin && roleChanging && nextRole !== "SUPERADMIN") {
    return "Cannot demote the last active superadmin";
  }
  if (targetIsLastActiveSuperadmin && activeChanging && nextActive === false) {
    return "Cannot deactivate the last active superadmin";
  }
  if (target.id === actor.id && activeChanging && nextActive === false) {
    return "Cannot deactivate your own account";
  }
  return null;
}

export function accountDeactivateError(
  actor: AccountActor,
  target: AccountTarget,
  activeSuperadminCount: number
): string | null {
  return accountMutationError(actor, target, { active: false }, activeSuperadminCount);
}
