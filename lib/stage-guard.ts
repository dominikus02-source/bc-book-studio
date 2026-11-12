/** Stored editorialStage values the application writes or still accepts. */
export const EDITORIAL_STAGES = ["BRIEF", "OUTLINE", "WRITING", "EDITING", "REVIEW", "LAYOUT"] as const;
export type EditorialStage = (typeof EDITORIAL_STAGES)[number];

export function isKnownEditorialStage(value: string): value is EditorialStage {
  return (EDITORIAL_STAGES as readonly string[]).includes(value);
}

/**
 * Legal Next-button advance. BRIEF goes to OUTLINE, OUTLINE goes to WRITING.
 * Skipping Ide or Rancang is not a workflow transition.
 * PDF import and an explicit post-approval revision are separate named paths.
 */
export function stageRequiredBefore(to: "OUTLINE" | "WRITING"): "BRIEF" | "OUTLINE" {
  return to === "OUTLINE" ? "BRIEF" : "OUTLINE";
}

export function workflowAdvanceAllowed(current: string, to: "OUTLINE" | "WRITING", ready: boolean): boolean {
  return ready && current === stageRequiredBefore(to);
}
