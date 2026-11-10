import {z} from "zod";
export const modules=["Idea Lab","Studio Latihan","Kurikulum","Studio Visual","Pusat Agen","Pengaturan"] as const;
export const moduleName=z.enum(modules);
const forbidden=/password|passphrase|api.?key|secret|token|credential|authorization|private.?key/i;
export const payloadSchema=z.record(z.string().min(1).max(60),z.union([z.string().max(12000),z.boolean()])).refine(v=>Object.keys(v).length<=40,"Terlalu banyak field").refine(v=>Object.keys(v).every(k=>!forbidden.test(k)),"Field rahasia tidak diizinkan").refine(v=>JSON.stringify(v).length<=18000,"Draf melebihi batas data");
export const draftSchema=z.object({module:moduleName,title:z.string().trim().min(2).max(140),payload:payloadSchema}).strict();
export function inputError(e:unknown){return e instanceof Error?e.message:"Data tidak valid";}
