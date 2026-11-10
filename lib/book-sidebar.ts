import {blockLayoutStyle,editorialSpacingCss,parseBlockLayout,type BlockLayout} from "./book-block-layout";

export const sidebarTypes = { note: "Info", tip: "Tips", warning: "Peringatan", important: "Penting" } as const;
export type SidebarType = keyof typeof sidebarTypes;
export type SidebarPosition = "left" | "right";

const header = /^::: \{\.callout-(note|tip|warning|important) \.bc-sidebar-(left|right)\}[ \t]*$/;

export function readSidebar(raw: string) {
 const lines = raw.replace(/\r\n/g, "\n").trimEnd().split("\n");
 const match = header.exec(lines[0]);
 if (!match || lines.at(-1) !== ":::") return null;
 return {type: match[1] as SidebarType, position: match[2] as SidebarPosition, body: lines.slice(1, -1).join("\n")};
}

export function sidebarMarkdown(type: SidebarType, position: SidebarPosition, body: string) {
 return "::: {.callout-" + type + " .bc-sidebar-" + position + "}\n" + body + "\n:::";
}

const openerHeader = "::: {.callout-note .bc-chapter-opener}";
export function chapterOpenerMarkdown(prompt: string, image = "") {
 return [openerHeader, image, "**Pertanyaan pemantik**", "", prompt, ":::"].filter((line, index) => index !== 1 || line).join("\n");
}

export function readChapterOpener(raw: string) {
 const lines = raw.replace(/\r\n/g, "\n").trimEnd().split("\n");
 if (lines[0] !== openerHeader || lines.at(-1) !== ":::") return null;
 const image = /^!\[[^\]]*\]\(asset:[a-z0-9]{6,100}\)$/.test(lines[1]) ? lines[1] : "";
 const promptStart = image ? 4 : 3;
 return { image, prompt: lines.slice(promptStart, -1).join("\n") };
}

export function prepareSidebarHtml(source: string) {
 const fragments: string[] = [];
 const marker = (html: string) => "\n\nBCSIDEBARTOKEN" + (fragments.push(html) - 1) + "END\n\n";
 const lines = source.split("\n");
 const blocks: {index:number; match:RegExpExecArray|null; opener:boolean; layout:BlockLayout|null}[] = [];
 let codeFence = "";
 for (let index = 0; index < lines.length; index++) {
  const line = lines[index];
  const fence = /^ {0,3}([`~]{3,})(.*)$/.exec(line);
  if (codeFence) {
   if (fence && fence[1][0] === codeFence[0] && fence[1].length >= codeFence.length && !fence[2].trim()) codeFence = "";
   continue;
  }
  if (fence) { codeFence = fence[1]; continue; }
  if (/^:::\s*\{/.test(line)) { blocks.push({index, match:header.exec(line), opener:line===openerHeader,layout:parseBlockLayout(line)}); continue; }
  if (!/^:::[ \t]*$/.test(line)) continue;
  const opened = blocks.pop();
  if(opened?.layout){
   lines[opened.index]=marker('<div class="bc-block-layout" style="box-sizing:border-box;max-width:100%;display:flow-root;'+blockLayoutStyle(opened.layout)+'">');
   lines[index]=marker("</div>");
   continue;
  }
  if (opened?.opener) {
   lines[opened.index] = marker('<section class="book-chapter-opener" aria-label="Pembuka bab">');
   lines[index] = marker("</section>");
   continue;
  }
  if (!opened?.match) continue;
  const [, type, position] = opened.match;
  lines[opened.index] = marker('<aside class="book-sidebar book-sidebar-' + position + ' book-sidebar-' + type + '" aria-label="' + sidebarTypes[type as SidebarType] + '">');
  lines[index] = marker("</aside>");
 }
 const markdown = lines.join("\n");
 return { markdown, restore: (html: string) => html.replace(/<p>BCSIDEBARTOKEN(\d+)END<\/p>/g, (_match, index) => fragments[Number(index)] ?? "") };
}

export const bookSidebarCss = `${editorialSpacingCss}
.writing-preview-paper,.book-page{container-type:inline-size}
.book-sidebar{box-sizing:border-box;display:flow-root;width:42%;max-width:100%;padding:12px;border:1px solid currentColor;border-inline-start:4px solid #4870c0;border-radius:8px;margin-block:.5em 1em;overflow-wrap:anywhere;break-inside:avoid}
.book-chapter-opener{margin:1em 0 1.5em;padding:clamp(12px,3vw,16px);border:1px solid currentColor;border-inline-start:5px solid #4870c0;border-radius:8px;overflow-wrap:anywhere;break-inside:avoid}
.book-chapter-opener img{display:block;width:100%;max-height:360px;object-fit:contain;margin:0 auto 12px;border-radius:8px}
.book-chapter-opener p:last-child{margin-bottom:0}
.book-sidebar-left{float:left;margin-inline:0 1em}
.book-sidebar-right{float:right;margin-inline:1em 0}
.book-sidebar-warning,.book-sidebar-important{border-inline-start-color:#b45309}
.book-sidebar-tip{border-inline-start-color:#20835c}
.book-sidebar img{max-width:100%;height:auto}
.book-sidebar :first-child{margin-top:0}
.book-sidebar :last-child{margin-bottom:0}
@container(max-width:500px){.book-sidebar{float:none;width:100%;margin-inline:0}}
@media print{.book-sidebar{float:none;width:100%;margin-inline:0}}
`;