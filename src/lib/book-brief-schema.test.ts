import { describe, expect, it } from "vitest";
import { bookBriefSchema } from "./book-brief-schema";

const valid = {
  title: "Buku Literasi",
  purpose: "Meningkatkan kemampuan literasi pembaca sasaran.",
  problem: "Pembaca kesulitan memahami gagasan dalam teks.",
  topics: "Membaca kritis",
  outputs: ["pdf" as const, "epub" as const],
};

describe("bookBriefSchema", () => {
  it("accepts a valid brief", () => {
    expect(bookBriefSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects incomplete briefs", () => {
    expect(bookBriefSchema.safeParse({ ...valid, purpose: "" }).success).toBe(false);
  });
  it("rejects an empty list of outputs", () => {
    expect(bookBriefSchema.safeParse({ ...valid, outputs: [] }).success).toBe(false);
  });
});
