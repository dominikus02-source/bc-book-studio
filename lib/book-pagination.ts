import {z} from "zod";

export const paginationSchema=z.object({
 frontMatter:z.literal("lowerRoman"),
 mainMatter:z.literal("arabicStart1"),
 backMatter:z.literal("continueArabic"),
 chapterStart:z.enum(["recto","nextPage"]),
 chapterOpeningFolio:z.enum(["bottom","hidden","outer"]),
 normalFolioPosition:z.enum(["outer","center","top"]),
 runningHeaders:z.boolean(),
 headerText:z.string().trim().max(70).optional(),
 footerText:z.string().trim().max(70).optional(),
 autoUpdateToc:z.boolean(),
 listLeader:z.enum(["dots","dashes","empty"]).optional(),
 covers:z.literal("noPrintedFolio"),
}).strict();

export type PaginationSettings=z.infer<typeof paginationSchema>;

export const DEFAULT_PAGINATION:PaginationSettings=Object.freeze({
 frontMatter:"lowerRoman",mainMatter:"arabicStart1",backMatter:"continueArabic",
 chapterStart:"recto",chapterOpeningFolio:"bottom",normalFolioPosition:"outer",
 runningHeaders:true,autoUpdateToc:true,covers:"noPrintedFolio",
});

export function validatePagination(value:unknown):PaginationSettings{
 return paginationSchema.parse(value);
}
export function isPrintedFolio(section:"cover"|"front"|"main"|"back"|"backCover",isOpener=false){
 if(section==="cover"||section==="backCover")return false;
 return !isOpener||DEFAULT_PAGINATION.chapterOpeningFolio!=="hidden";
}
