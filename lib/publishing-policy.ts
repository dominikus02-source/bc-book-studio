/**
 * Genre-driven, cross-stage editorial contract.
 * Source policy: Perpusnas ISBN regulation 11/2025, current Perpusnas ISBN guidance,
 * International ISBN Agency and W3C EPUB Accessibility 1.1.
 * This contract verifies declared readiness, NOT official ISBN issuance.
 */
export const publishingPolicyVersion = "2026-11-08.1";
export const supportedGenres = ["NOVEL", "SHORT_STORY", "ANTHOLOGY", "POETRY", "TEXTBOOK", "REFERENCE", "GUIDE", "WORKBOOK"] as const;
export type SupportedGenre = (typeof supportedGenres)[number];
const fictionGenres: readonly string[] = ["NOVEL", "SHORT_STORY", "ANTHOLOGY", "POETRY"];
export function genrePolicy(genre: string, bookType: string) {
  if (!supportedGenres.includes(genre as SupportedGenre)) return { valid: false, category: "UNKNOWN", requirements: [] as string[] };
  const fiction = fictionGenres.includes(genre);
  if (bookType !== (fiction ? "FICTION" : "NONFICTION")) return { valid: false, category: "MISMATCH", requirements: [] as string[] };
  const base = ["internationalMetadata", "frontMatterConsistent", "rightsClearance", "accessibilityChecked", "layoutVerified", "editionFormatRegistered", "publisherVerified", "perpusnasSubmissionPrepared", "isbnEligibilityReviewed"];
  const category = genre === "WORKBOOK" ? "WORKBOOK_REQUIRES_ELIGIBILITY_REVIEW" : fiction ? "FICTION" : "NONFICTION";
  const extra = fiction
    ? ["characterAndPlotCoherence", "fictionLanguageEdited"]
    : ["factualClaimsVerified", "sourceCitationsChecked", "educationalSuitabilityReviewed"];
  const specialized = genre === "ANTHOLOGY" ? ["contributorPermissionsChecked"] :
    genre === "POETRY" ? ["poemSequenceReviewed"] :
    genre === "TEXTBOOK" ? ["learningObjectivesAligned", "assessmentAnswersChecked"] :
    genre === "WORKBOOK" ? ["exerciseSolutionsChecked", "workbookDistributionReviewed"] :
    genre === "REFERENCE" ? ["indexAndBibliographyChecked"] :
    genre === "NOVEL" ? ["narrativeContinuityReviewed"] : [];
  return { valid: true, category, requirements: [...base, ...extra, ...specialized] };
}
/**
 * Editorial checklist booleans are *attestations only*. This never returns
 * "ISBN issued"; actual allocation requires independently verified evidence.
 */
export function publicationPolicyBlockers(genre: string, bookType: string, checks: Record<string, unknown>) {
  const policy = genrePolicy(genre, bookType);
  if (!policy.valid) return ["Genre and book type are inconsistent or unsupported."];
  return policy.requirements.filter(key => checks[key] !== true).map(key => "Required genre/publishing control incomplete: " + key);
}
