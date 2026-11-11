/** Bibliographic language stored on a book. id and en are the supported BCP 47 tags. */
export function bookLanguage(value: string | null | undefined): "id" | "en" {
  const tag = String(value || "").trim().toLowerCase();
  return tag === "en" || tag.startsWith("en-") ? "en" : "id";
}
export function docxLanguage(value: string | null | undefined) {
  return bookLanguage(value) === "en" ? "en-US" : "id-ID";
}
export function languageLabel(value: string | null | undefined) {
  return bookLanguage(value) === "en" ? "English (en)" : "Indonesia (id)";
}
