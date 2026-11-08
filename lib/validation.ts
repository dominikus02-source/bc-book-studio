import { z } from "zod";
export const createBook = z.object({
  title: z.string().trim().min(2).max(180),
  grade: z.enum(["1","2","3","4","5","6","7","8","9","10","11","12","Referensi"]),
  subject: z.string().trim().min(2).max(100),
  description: z.string().max(12000).default(""),
  targetAudience: z.string().trim().max(300).default(""),
  writingGoal: z.string().trim().max(1500).default(""),
  bookType: z.enum(["FICTION","NONFICTION"]).default("NONFICTION"),
  pageSize: z.enum(["A4","A5","B5"]).default("A4"),
  author: z.string().trim().min(2).max(180).default("BC Book Studio"),
  genre: z.enum(["NOVEL","SHORT_STORY","ANTHOLOGY","POETRY","TEXTBOOK","REFERENCE","GUIDE","WORKBOOK"]).default("REFERENCE")
}).superRefine((data,ctx)=>{
 const fiction=["NOVEL","SHORT_STORY","ANTHOLOGY","POETRY"].includes(data.genre);
 if((data.bookType==="FICTION")!==fiction)ctx.addIssue({code:"custom",path:["genre"],message:"Book type and genre must match"});
});
export const chapterInput = z.object({
  title: z.string().trim().min(2).max(180),
  content: z.string().trim().min(20).max(100000)
});
export const reviewInput = z.object({
  action: z.enum(["submit","approve","reject"]),
  note: z.string().max(2000).default("")
});
export function badInput(error: unknown) {
  return error instanceof z.ZodError ? { error: "Invalid input", issues: error.issues } : { error: "Invalid JSON or input" };
}
