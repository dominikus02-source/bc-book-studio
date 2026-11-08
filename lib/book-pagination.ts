import {z} from "zod";

export const paginationSchema=z.object({
 frontMatter:z.literal("lowerRoman"),
 mainMatter:z.literal("arabicStart1"),
 backMatter:z.literal("continueArabic"),
 chapterStart:z.enum(["recto","nextPage"]),
 chapterOpeningFolio:z.enum(["bottom","hidden","outer"]),
 normalFolioPosition:z.enum(["outer","center","top"]),
 runningHeaders:z.boolean(),
 autoUpdateToc:z.boolean(),
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

export function isPrintedFolio(
 section:"cover"|"front"|"main"|"back"|"backCover",
 isOpener=false,
 settings:PaginationSettings=DEFAULT_PAGINATION
){
 if(section==="cover"||section==="backCover")return false;
 return !isOpener||settings.chapterOpeningFolio!=="hidden";
}
