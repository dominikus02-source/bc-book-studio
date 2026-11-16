export const REVIEW_POLICIES = ["ANY", "ALL", "MAJORITY", "MIN_N", "LEAD"] as const;
/** Assigned accounts that count toward the approval threshold. SUPERADMIN counts only after an explicit assignment. */
export const COUNTED_REVIEWER_ROLES = ["REVIEWER", "ADMIN", "SUPERADMIN"] as const;
export type ReviewPolicyName = (typeof REVIEW_POLICIES)[number];

export type PolicyVerdict = {
  met: boolean;
  have: number;
  need: number;
  waitingOnLead: boolean;
  label: string;
};

const reviewerMark = /\[Reviewer: ([^\]]+)\]\s*$/;

export function reviewerIdFromDecisionNote(note: string) {
  return note.match(reviewerMark)?.[1] ?? null;
}

/**
 * Approvals count only after the latest submit and before any return.
 * A reject newer than the submit closes the round: those approvals do not carry over.
 * Decisions stay append-only; the next submit starts a fresh round.
 */
export function currentRoundApproverIds(reviewsNewestFirst: { decision: string; note: string }[], assignedIds: Iterable<string>) {
  const assigned = new Set(assignedIds);
  const ids = new Set<string>();
  for (const row of reviewsNewestFirst) {
    if (row.decision === "submit") break;
    if (row.decision === "reject") return new Set<string>();
    if (row.decision !== "approve") continue;
    const id = reviewerIdFromDecisionNote(row.note);
    if (id && assigned.has(id)) ids.add(id);
  }
  return ids;
}

export function approvalNeed(policy: ReviewPolicyName, assignedCount: number, minN: number | null) {
  const count = Math.max(0, assignedCount);
  if (count === 0) return Number.POSITIVE_INFINITY;
  if (policy === "ANY" || policy === "LEAD") return 1;
  if (policy === "ALL") return count;
  if (policy === "MAJORITY") return Math.floor(count / 2) + 1;
  const requested = minN ?? 1;
  return Math.min(Math.max(1, requested), count);
}

export function policyVerdict(input: {
  policy: ReviewPolicyName;
  assignedIds: string[];
  approverIds: Iterable<string>;
  leadReviewerId?: string | null;
  minN?: number | null;
}): PolicyVerdict {
  const assigned = new Set(input.assignedIds);
  const approvers = new Set([...input.approverIds].filter(id => assigned.has(id)));
  if (input.policy === "LEAD") {
    const lead = input.leadReviewerId ?? "";
    const met = Boolean(lead && assigned.has(lead) && approvers.has(lead));
    return {
      met,
      have: met ? 1 : 0,
      need: 1,
      waitingOnLead: !met,
      label: met ? "Reviewer utama sudah menyetujui." : "Menunggu reviewer utama.",
    };
  }
  const need = approvalNeed(input.policy, assigned.size, input.minN ?? null);
  const have = approvers.size;
  const met = Number.isFinite(need) && have >= need;
  const label = met
    ? `Persetujuan ${have} dari ${need} reviewer.`
    : `Persetujuan ${have} dari ${need} reviewer. Menunggu reviewer lain.`;
  return { met, have, need, waitingOnLead: false, label };
}

/** ALL and MAJORITY shrink with the remaining reviewers. MIN_N stays fixed and can become impossible. */
export function unassignKeepsPolicyPossible(input: {
  policy: ReviewPolicyName;
  assignedIds: string[];
  removeId: string;
  minN?: number | null;
  leadReviewerId?: string | null;
}) {
  const remaining = input.assignedIds.filter(id => id !== input.removeId);
  if (remaining.length < 1) return { ok: false as const, error: "Sedikitnya satu peninjau harus tetap ditugaskan." };
  if (input.policy === "LEAD" && input.leadReviewerId === input.removeId) {
    return { ok: false as const, error: "Reviewer utama tidak dapat dicabut selama kebijakan ini terkunci. Kembalikan naskah bila susunan peninjau harus berubah." };
  }
  if (input.policy === "MIN_N" && (input.minN ?? 1) > remaining.length) {
    return { ok: false as const, error: "Jumlah peninjau tersisa lebih kecil dari batas persetujuan." };
  }
  return { ok: true as const, remaining };
}
