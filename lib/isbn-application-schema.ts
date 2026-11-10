import {z} from "zod";
import {ISBN_FORMS,ISBN_RIGHTS,safeExternalUrl} from "./isbn-office";
import {paperSpec} from "./paper-sizes";
export const payload=z.object({
 bookId:z.string().min(10),
 title:z.string().trim().min(3).max(300),
 subtitle:z.string().trim().max(500).default(""),
 authorNames:z.string().trim().min(2).max(500),
 language:z.string().trim().regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/).default("id"),
 editionNumber:z.number().int().min(1).max(100),
 format:z.enum(ISBN_FORMS),
 binding:z.enum(["PAPERBACK","HARDCOVER","NONE"]).default("PAPERBACK"),
 paperSize:z.string().refine(v=>Boolean(paperSpec(v))),
 imprint:z.string().trim().min(2).max(200),
 plannedPublicationYear:z.number().int().min(2020).max(2100).nullable().optional(),
 catalogUrl:z.string().max(1000).refine(safeExternalUrl),
 territory:z.string().max(200).default("GLOBAL"),
 rightsBasis:z.enum(ISBN_RIGHTS),
 originalWorkReference:z.string().max(1000).default(""),
 note:z.string().max(5000).default("")
}).strict();
