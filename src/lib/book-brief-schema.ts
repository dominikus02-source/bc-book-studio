import { z } from "zod";

export const bookBriefSchema = z.object({
  title: z.string().trim().max(180),
  purpose: z.string().trim().min(20).max(5000),
  problem: z.string().trim().min(10).max(5000),
  topics: z.string().trim().min(5).max(10000),
  outputs: z.array(z.enum(["pdf", "epub", "html", "docx"])).min(1),
});

export type BookBriefInput = z.infer<typeof bookBriefSchema>;
