export const REVIEWER_ROLES = ["REVIEWER", "ADMIN", "SUPERADMIN"] as const;
export const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"] as const;
export type ReviewerRole = (typeof REVIEWER_ROLES)[number];
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Roles that may be assigned as reviewers and, when assigned and not the owner, approve or reject. */
export function isReviewerRole(role: string): role is ReviewerRole {
  return (REVIEWER_ROLES as readonly string[]).includes(role);
}

/** Roles that inherit ADMIN publisher, ISBN, settings, and evidence-review permissions. */
export function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}
